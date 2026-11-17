import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterEach, describe, expect, it } from 'vitest';

import type { CompanySavePort } from '../../src/authority';
import { createJwtAuthenticator, createSupabaseAuthenticator, type Authenticate } from '../../src/server/api/auth';
import { readCompanyConfigFromEnvironment } from '../../src/server/api/config';
import { createApiServer, type CompanyStore } from '../../src/server/api/server';
import { InMemorySave } from '../authority/inMemorySave';

const rules = { weeksPerSeason: 3, seasonsPerYear: 4 };
const initialDate = { year: 2030, season: 1, week: 1 };
const command = { type: 'time.advance' };

/** Models owner authorization and atomic creation at the external store boundary. */
class OwnerBoundMemory {
  readonly saves = new InMemorySave();
  readonly owners = new Map<string, string>();

  store(owner: string): CompanyStore {
    const owns = (companyId: string) => this.owners.get(companyId) === owner;
    return {
      listCompanies: async () => ({ kind: 'listed', companyIds: [...this.owners].filter(([, id]) => id === owner).map(([id]) => id).sort() }),
      createCompany: async ({ companyId, state }) => {
        if (this.owners.has(companyId)) return { kind: 'not-created' };
        this.owners.set(companyId, owner);
        this.saves.seed(companyId, state);
        return { kind: 'created' };
      },
      load: async (companyId) => owns(companyId) ? this.saves.load(companyId) : { kind: 'missing' },
      getReceipt: async (companyId, commandId) => owns(companyId) ? this.saves.getReceipt(companyId, commandId) : { kind: 'unavailable', details: 'private detail' },
      commit: async (input) => owns(input.companyId) ? this.saves.commit(input) : { kind: 'failed', details: 'private detail' },
      resolveAttempt: async (input) => owns(input.companyId) ? this.saves.resolveAttempt(input) : { kind: 'unavailable', details: 'private detail' },
    } satisfies CompanySavePort & CompanyStore;
  }
}

const running: Server[] = [];

async function start(database: OwnerBoundMemory, authenticate: Authenticate = async (header) => header === 'Bearer alice' ? 'alice' : header === 'Bearer bob' ? 'bob' : null): Promise<string> {
  const server = createApiServer({
    authenticate,
    storeForOwner: (owner) => database.store(owner),
    newCompany: { rules, initialDate },
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  running.push(server);
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

async function stop(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  running.splice(running.indexOf(server), 1);
}

afterEach(async () => {
  for (const server of [...running]) await stop(server);
});

async function call(base: string, path: string, options: { token?: string; body?: unknown; method?: string } = {}) {
  const response = await fetch(`${base}${path}`, {
    method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
    headers: {
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

async function create(base: string, companyId = 'vineyard') {
  return call(base, '/companies', { token: 'alice', body: { companyId } });
}

describe('company HTTP authority', () => {
  it('requires authentication, derives ownership from it, and makes inaccessible companies look missing', async () => {
    const database = new OwnerBoundMemory();
    const base = await start(database);
    expect(await call(base, '/companies/vineyard')).toEqual({ status: 401, body: { kind: 'unauthorized' } });
    expect(await create(base)).toEqual({ status: 201, body: { kind: 'created' } });
    const hidden = await call(base, '/companies/vineyard', { token: 'bob' });
    const missing = await call(base, '/companies/nonexistent', { token: 'bob' });
    expect(hidden).toEqual(missing);
    expect(hidden).toEqual({ status: 404, body: { kind: 'missing' } });
    expect(await call(base, '/companies', { token: 'bob', body: { companyId: 'spoof', ownerId: 'alice' } })).toEqual({ status: 400, body: { kind: 'invalid-input' } });
    expect(database.owners.has('spoof')).toBe(false);
    expect(await call(base, '/companies', { token: 'bob', body: { companyId: 'vineyard' } })).toEqual({ status: 409, body: { kind: 'not-created' } });
    expect(await call(base, '/companies', { token: 'bob', body: { companyId: 'bob-company' } })).toEqual({ status: 201, body: { kind: 'created' } });
    expect(await call(base, '/companies/bob-company', { token: 'alice' })).toEqual({ status: 404, body: { kind: 'missing' } });
    expect((await call(base, '/companies/bob-company', { token: 'bob' })).body.kind).toBe('loaded');
    expect((await call(base, '/companies', { token: 'alice' })).body).toEqual({ kind: 'listed', companyIds: ['vineyard'] });
    expect((await call(base, '/companies', { token: 'bob' })).body).toEqual({ kind: 'listed', companyIds: ['bob-company'] });
  });

  it('uses trusted creation configuration and rejects client overrides or candidate state', async () => {
    const database = new OwnerBoundMemory();
    const base = await start(database);
    for (const override of [{ rules }, { initialDate }, { rules, initialDate }, { state: {} }]) {
      expect((await call(base, '/companies', { token: 'alice', body: { companyId: 'a', ...override } })).status).toBe(400);
    }
    expect((await call(base, '/companies', { token: 'alice', body: {} })).status).toBe(400);
    expect(database.owners.size).toBe(0);
    await create(base);
    expect((await call(base, '/companies/vineyard', { token: 'alice' })).body).toMatchObject({
      snapshot: { state: { calendar: { rules, date: initialDate } } },
    });
    const injected = await call(base, '/companies/vineyard/commands', {
      token: 'alice', body: { commandId: 'c1', expectedRevision: 0, command, next: { calendar: {} } },
    });
    expect(injected.status).toBe(400);
    const disguised = await call(base, '/companies/vineyard/commands', {
      token: 'alice', body: { commandId: 'c1', expectedRevision: 0, command: { ...command, next: {} } },
    });
    expect(disguised.status).toBe(400);
    expect(database.saves.companies.get('vineyard')?.revision).toBe(0);
  });

  it('commits valid commands, deduplicates retries without replaying events, and rejects stale revisions', async () => {
    const database = new OwnerBoundMemory();
    const base = await start(database);
    await create(base);
    const body = { commandId: 'advance-1', expectedRevision: 0, command };
    const first = await call(base, '/companies/vineyard/commands', { token: 'alice', body });
    expect(first.status).toBe(200);
    expect(first.body.kind).toBe('committed');
    expect(first.body.events).toHaveLength(1);
    expect(await call(base, '/companies/vineyard/commands', { token: 'alice', body })).toEqual({ status: 200, body: { kind: 'already-committed', revision: 1 } });
    expect(await call(base, '/companies/vineyard/commands', { token: 'alice', body: { ...body, commandId: 'advance-2' } })).toEqual({ status: 409, body: { kind: 'conflict', currentRevision: 1 } });
    expect(database.saves.writes).toBe(1);
    const loaded = await call(base, '/companies/vineyard', { token: 'alice' });
    expect(loaded.body).toMatchObject({ kind: 'loaded', snapshot: { revision: 1, state: { calendar: { date: { week: 2 } } } } });
  });

  it('serializes concurrent requests to the same company', async () => {
    const database = new OwnerBoundMemory();
    const base = await start(database);
    await create(base);
    const results = await Promise.all(['one', 'two'].map((commandId) => call(base, '/companies/vineyard/commands', {
      token: 'alice', body: { commandId, expectedRevision: 0, command },
    })));
    expect(results.map((result) => result.body.kind).sort()).toEqual(['committed', 'conflict']);
    expect(database.saves.writes).toBe(1);
  });

  it('rejects a command ID already associated with a different semantic payload', async () => {
    const database = new OwnerBoundMemory();
    const base = await start(database);
    await create(base);
    database.saves.receipts.set(JSON.stringify(['vineyard', 'used']), {
      companyId: 'vineyard', commandId: 'used', fingerprint: '{"type":"other"}', revision: 1,
    });
    expect(await call(base, '/companies/vineyard/commands', {
      token: 'alice', body: { commandId: 'used', expectedRevision: 0, command },
    })).toEqual({ status: 409, body: { kind: 'command-id-mismatch' } });
    expect(database.saves.writes).toBe(0);
  });

  it('blocks further commands while an uncertain outcome is pending and resolves the original attempt', async () => {
    const database = new OwnerBoundMemory();
    const base = await start(database);
    await create(base);
    database.saves.nextCommit = 'commit-then-unknown';
    const body = { commandId: 'uncertain', expectedRevision: 0, command };
    expect(await call(base, '/companies/vineyard/commands', { token: 'alice', body })).toEqual({ status: 202, body: { kind: 'unknown', commandId: 'uncertain' } });
    expect(await call(base, '/companies/vineyard/commands', { token: 'alice', body: { ...body, commandId: 'other' } })).toEqual({ status: 409, body: { kind: 'blocked', reason: 'unresolved', pending: { commandId: 'uncertain' } } });
    expect((await call(base, '/companies/vineyard/resolve', { token: 'alice', body: { commandId: 'other' } })).status).toBe(400);
    database.saves.resolution = 'pending';
    expect(await call(base, '/companies/vineyard/resolve', { token: 'alice', body: { commandId: 'uncertain' } })).toEqual({ status: 202, body: { kind: 'pending' } });
    database.saves.resolution = 'normal';
    expect(await call(base, '/companies/vineyard/resolve', { token: 'alice', body: { commandId: 'uncertain' } })).toEqual({ status: 200, body: { kind: 'committed', revision: 1 } });
    expect(database.saves.writes).toBe(1);
  });

  it('fences a late attempt before reporting it did not commit', async () => {
    const database = new OwnerBoundMemory();
    const base = await start(database);
    await create(base);
    database.saves.nextCommit = 'late-unknown';
    await call(base, '/companies/vineyard/commands', { token: 'alice', body: { commandId: 'late', expectedRevision: 0, command } });
    expect(database.saves.lateAttempt?.attemptId).not.toBe('late');
    expect(await call(base, '/companies/vineyard/resolve', { token: 'alice', body: { commandId: 'late' } })).toEqual({ status: 200, body: { kind: 'not-committed' } });
    expect(database.saves.runLateAttempt().kind).toBe('failed');
  });

  it('does not let another delayed delivery of a fenced command commit after resolution', async () => {
    const database = new OwnerBoundMemory();
    const first = await start(database);
    const second = await start(database);
    await create(first);
    const intent = { commandId: 'same-intent', expectedRevision: 0, command };
    let started!: () => void;
    let release!: () => void;
    const waiting = new Promise<void>(resolve => { started = resolve; });
    const held = new Promise<void>(resolve => { release = resolve; });
    database.saves.beforeCommit = async () => { started(); await held; };
    const delayed = call(first, '/companies/vineyard/commands', { token: 'alice', body: intent });
    await waiting;
    database.saves.beforeCommit = undefined;
    try {
      database.saves.nextCommit = 'reservation-then-unknown';
      expect((await call(second, '/companies/vineyard/commands', { token: 'alice', body: intent })).body.kind).toBe('unknown');
      expect((await call(second, '/companies/vineyard/resolve', { token: 'alice', body: { commandId: intent.commandId } })).body.kind).toBe('not-committed');
    } finally {
      release();
    }
    expect((await delayed).body.kind).toBe('failed');
    expect(database.saves.writes).toBe(0);
  });

  it('settles an unknown committed attempt by retrying its exact command ID and payload', async () => {
    const database = new OwnerBoundMemory();
    const base = await start(database);
    await create(base);
    const uncertain = { commandId: 'uncertain', expectedRevision: 0, command };
    database.saves.nextCommit = 'commit-then-unknown';
    expect((await call(base, '/companies/vineyard/commands', { token: 'alice', body: uncertain })).body.kind).toBe('unknown');
    expect(await call(base, '/companies/vineyard/commands', { token: 'alice', body: uncertain })).toEqual({
      status: 200, body: { kind: 'already-committed', revision: 1 },
    });
    expect((await call(base, '/companies/vineyard/commands', {
      token: 'alice', body: { commandId: 'next', expectedRevision: 1, command },
    })).body.kind).toBe('committed');
    expect(database.saves.writes).toBe(2);
  });

  it('discovers another instance’s durable reservation and blocks conflicting commands without leaking the attempt', async () => {
    const database = new OwnerBoundMemory();
    const first = await start(database);
    const second = await start(database);
    await create(first);
    await call(second, '/companies/vineyard', { token: 'alice' });

    let signalStarted!: () => void;
    let release!: () => void;
    const started = new Promise<void>((resolve) => { signalStarted = resolve; });
    const paused = new Promise<void>((resolve) => { release = resolve; });
    database.saves.beforeCommit = async () => { signalStarted(); await paused; };
    const competing = call(second, '/companies/vineyard/commands', {
      token: 'alice', body: { commandId: 'competing', expectedRevision: 0, command },
    });
    await started;
    database.saves.beforeCommit = undefined;
    database.saves.nextCommit = 'reservation-then-unknown';
    expect(await call(first, '/companies/vineyard/commands', {
      token: 'alice', body: { commandId: 'reserved', expectedRevision: 0, command },
    })).toEqual({ status: 202, body: { kind: 'unknown', commandId: 'reserved' } });
    release();

    expect(await competing).toEqual({
      status: 409, body: { kind: 'blocked', reason: 'unresolved', pending: { commandId: 'reserved' } },
    });
    const loaded = await call(second, '/companies/vineyard', { token: 'alice' });
    expect(loaded.body.pending).toEqual({ commandId: 'reserved' });
    expect(JSON.stringify(loaded.body)).not.toContain('attemptId');
    expect(JSON.stringify(loaded.body)).not.toContain('fingerprint');
    expect(await call(second, '/companies/vineyard', { token: 'bob' })).toEqual({ status: 404, body: { kind: 'missing' } });
  });

  it('recovers and fences a durable reservation after restart, allowing a new command', async () => {
    const database = new OwnerBoundMemory();
    const first = await start(database);
    await create(first);
    database.saves.nextCommit = 'reservation-then-unknown';
    expect((await call(first, '/companies/vineyard/commands', {
      token: 'alice', body: { commandId: 'late', expectedRevision: 0, command },
    })).status).toBe(202);
    await stop(running[0]);

    const restarted = await start(database);
    const loaded = await call(restarted, '/companies/vineyard', { token: 'alice' });
    expect(loaded.body.pending).toEqual({ commandId: 'late' });
    expect(await call(restarted, '/companies/vineyard/resolve', {
      token: 'bob', body: { commandId: 'late' },
    })).toEqual({ status: 404, body: { kind: 'missing' } });
    expect(await call(restarted, '/companies/vineyard/commands', {
      token: 'alice', body: { commandId: 'new', expectedRevision: 0, command },
    })).toEqual({ status: 409, body: { kind: 'blocked', reason: 'unresolved', pending: { commandId: 'late' } } });
    const resolution = { token: 'alice', body: { commandId: 'late' } };
    database.saves.resolution = 'pending';
    expect(await call(restarted, '/companies/vineyard/resolve', resolution)).toEqual({ status: 202, body: { kind: 'pending' } });
    database.saves.resolution = 'normal';
    expect(await call(restarted, '/companies/vineyard/resolve', resolution)).toEqual({ status: 200, body: { kind: 'not-committed' } });
    expect(database.saves.runLateAttempt().kind).toBe('failed');
    expect((await call(restarted, '/companies/vineyard/commands', {
      token: 'alice', body: { commandId: 'new', expectedRevision: 0, command },
    })).body.kind).toBe('committed');
  });

  it('replays a committed receipt while an unrelated durable attempt is pending', async () => {
    const database = new OwnerBoundMemory();
    const first = await start(database);
    const second = await start(database);
    await create(first);
    const already = { commandId: 'already', expectedRevision: 0, command };
    expect((await call(first, '/companies/vineyard/commands', { token: 'alice', body: already })).body.kind).toBe('committed');
    database.saves.nextCommit = 'reservation-then-unknown';
    await call(first, '/companies/vineyard/commands', {
      token: 'alice', body: { commandId: 'pending', expectedRevision: 1, command },
    });
    expect(await call(second, '/companies/vineyard/commands', { token: 'alice', body: already })).toEqual({
      status: 200, body: { kind: 'already-committed', revision: 1 },
    });
    expect((await call(second, '/companies/vineyard', { token: 'alice' })).body.pending).toEqual({ commandId: 'pending' });
  });

  it('resolves a receipt replay that could not initially refresh the snapshot', async () => {
    const database = new OwnerBoundMemory();
    const base = await start(database);
    await create(base);
    const body = { commandId: 'already', expectedRevision: 0, command };
    expect((await call(base, '/companies/vineyard/commands', { token: 'alice', body })).body.kind).toBe('committed');
    const load = database.saves.load.bind(database.saves);
    let reads = 0;
    database.saves.load = async (companyId) => {
      reads += 1;
      return reads === 3 ? { kind: 'unavailable', details: 'private database detail' } : load(companyId);
    };
    expect(await call(base, '/companies/vineyard/commands', { token: 'alice', body })).toEqual({
      status: 409, body: { kind: 'sync-required', commandId: 'already', load: { kind: 'unavailable' } },
    });
    expect((await call(base, '/companies/vineyard', { token: 'alice' })).body.pending).toEqual({ commandId: 'already' });
    expect(await call(base, '/companies/vineyard/resolve', {
      token: 'alice', body: { commandId: 'already' },
    })).toEqual({ status: 200, body: { kind: 'committed', revision: 1 } });
  });

  it('never treats an absent receipt after restart as proof of rollback', async () => {
    const database = new OwnerBoundMemory();
    const firstBase = await start(database);
    await create(firstBase);
    database.saves.nextCommit = 'late-unknown';
    await call(firstBase, '/companies/vineyard/commands', { token: 'alice', body: { commandId: 'late', expectedRevision: 0, command } });
    await stop(running[0]);
    const secondBase = await start(database);
    const resolution = { token: 'alice', body: { commandId: 'late' } };
    expect(await call(secondBase, '/companies/vineyard/resolve', resolution)).toEqual({ status: 202, body: { kind: 'pending', retry: 'original-command' } });
    expect(database.saves.runLateAttempt().kind).toBe('committed');
    expect(await call(secondBase, '/companies/vineyard/resolve', resolution)).toEqual({ status: 200, body: { kind: 'committed', revision: 1 } });
  });

  it('does not report an unavailable or malformed receipt as a resolved command', async () => {
    const database = new OwnerBoundMemory();
    const base = await start(database);
    await create(base);
    const resolution = { token: 'alice', body: { commandId: 'lost' } };
    database.saves.getReceipt = async () => ({ kind: 'unavailable', details: 'private storage detail' });
    expect(await call(base, '/companies/vineyard/resolve', resolution)).toEqual({ status: 503, body: { kind: 'unavailable' } });
    database.saves.getReceipt = async () => ({
      kind: 'found', receipt: { companyId: 'vineyard', commandId: 'lost', fingerprint: 'valid-shape', revision: 0 },
    });
    expect(await call(base, '/companies/vineyard/resolve', resolution)).toEqual({ status: 503, body: { kind: 'unavailable' } });
  });

  it('bounds request bodies and does not disclose store errors', async () => {
    const database = new OwnerBoundMemory();
    const base = await start(database);
    await create(base);
    expect((await call(base, '/companies', { token: 'alice', body: { data: 'x'.repeat(20_000) } })).status).toBe(413);
    database.saves.loadOverrides.set('vineyard', { kind: 'unavailable', details: 'private database credentials' });
    expect(await call(base, '/companies/vineyard', { token: 'alice' })).toEqual({ status: 503, body: { kind: 'unavailable' } });
  });
});

describe('server-owned company configuration', () => {
  const environment = {
    WINEMAKER_WEEKS_PER_SEASON: '3',
    WINEMAKER_SEASONS_PER_YEAR: '4',
    WINEMAKER_START_YEAR: '2030',
    WINEMAKER_START_SEASON: '1',
    WINEMAKER_START_WEEK: '1',
  };

  it('uses the selected calendar defaults and validates explicit overrides', () => {
    expect(readCompanyConfigFromEnvironment(environment)).toEqual({ rules, initialDate });
    expect(readCompanyConfigFromEnvironment({})).toEqual({
      rules: { weeksPerSeason: 12, seasonsPerYear: 4 },
      initialDate: { year: 1, season: 1, week: 1 },
    });
    expect(readCompanyConfigFromEnvironment({ ...environment, WINEMAKER_START_YEAR: '' }).initialDate.year).toBe(1);
    for (const change of [
      { WINEMAKER_START_YEAR: '1e3' },
      { WINEMAKER_WEEKS_PER_SEASON: '0' },
      { WINEMAKER_SEASONS_PER_YEAR: '9007199254740992' },
      { WINEMAKER_START_SEASON: '5' },
      { WINEMAKER_START_WEEK: '4' },
    ]) expect(() => readCompanyConfigFromEnvironment({ ...environment, ...change })).toThrow();
  });

  it('rejects an invalid supplied configuration before the server starts', () => {
    expect(() => createApiServer({
      authenticate: async () => null,
      storeForOwner: (owner) => new OwnerBoundMemory().store(owner),
      newCompany: { rules, initialDate: { ...initialDate, week: 4 } },
    })).toThrow('Invalid company startup configuration.');
  });
});

describe('Supabase JWT verification', () => {
  it('requires a valid signature, issuer, audience, expiry, and subject', async () => {
    const { publicKey, privateKey } = await generateKeyPair('ES256');
    const other = await generateKeyPair('ES256');
    const jwk = { ...await exportJWK(publicKey), kid: 'key-1', alg: 'ES256', use: 'sig' };
    const verify = createJwtAuthenticator('https://example.supabase.co/auth/v1', createLocalJWKSet({ keys: [jwk] }));
    const makeToken = async (options: { iss?: string; aud?: string; sub?: string | null; exp?: number | null; badSignature?: boolean } = {}) => {
      const jwt = new SignJWT({})
        .setProtectedHeader({ alg: 'ES256', kid: 'key-1' })
        .setIssuer(options.iss ?? 'https://example.supabase.co/auth/v1')
        .setAudience(options.aud ?? 'authenticated');
      if (options.sub !== null) jwt.setSubject(options.sub ?? 'verified-owner');
      if (options.exp !== null) jwt.setExpirationTime(options.exp ?? Math.floor(Date.now() / 1000) + 60);
      return jwt.sign(options.badSignature ? other.privateKey : privateKey);
    };
    expect(await verify(`Bearer ${await makeToken()}`)).toBe('verified-owner');
    const invalidTokens = [
      await makeToken({ iss: 'https://wrong.example/auth/v1' }),
      await makeToken({ aud: 'anon' }),
      await makeToken({ sub: null }),
      await makeToken({ exp: null }),
      await makeToken({ exp: Math.floor(Date.now() / 1000) - 1 }),
      await makeToken({ badSignature: true }),
    ];
    const base = await start(new OwnerBoundMemory(), verify);
    for (const invalid of invalidTokens) {
      expect(await verify(`Bearer ${invalid}`)).toBeNull();
      expect(await call(base, '/companies/vineyard', { token: invalid })).toEqual({ status: 401, body: { kind: 'unauthorized' } });
    }
    expect(await verify('Bearer broken.token')).toBeNull();
    expect(() => createSupabaseAuthenticator('http://example.supabase.co')).toThrow();
  });

  it('returns 401 for invalid credentials and a sanitized 503 when the key provider fails', async () => {
    const { privateKey } = await generateKeyPair('ES256');
    const token = await new SignJWT({}).setProtectedHeader({ alg: 'ES256', kid: 'key-1' })
      .setIssuer('https://example.supabase.co/auth/v1').setAudience('authenticated')
      .setSubject('owner').setExpirationTime(Math.floor(Date.now() / 1000) + 60).sign(privateKey);
    const badKeyProvider = createJwtAuthenticator('https://example.supabase.co/auth/v1', async () => {
      throw new Error(`private JWKS network detail ${token}`);
    });
    const base = await start(new OwnerBoundMemory(), badKeyProvider);
    expect(await call(base, '/companies/vineyard', { token: 'broken.token' })).toEqual({ status: 401, body: { kind: 'unauthorized' } });
    expect(await call(base, '/companies/vineyard', { token })).toEqual({ status: 503, body: { kind: 'unavailable' } });
    const badKey = createJwtAuthenticator('https://example.supabase.co/auth/v1', createLocalJWKSet({ keys: [] }));
    const badKeyBase = await start(new OwnerBoundMemory(), badKey);
    expect(await call(badKeyBase, '/companies/vineyard', { token })).toEqual({ status: 401, body: { kind: 'unauthorized' } });
  });
});
