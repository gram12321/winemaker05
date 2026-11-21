import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';

import type { CompanySavePort, CompanyStore } from '../../src/authority';
import type { PlayerProfileRecord, PlayerProfileStore } from '../../src/server/playerProfiles';
import { readCompanyConfigFromEnvironment } from '../../src/server/api/config';
import { createApiServer } from '../../src/server/api/server';
import { InMemorySave } from '../authority/inMemorySave';

const rules = { weeksPerSeason: 3, seasonsPerYear: 4 };
const initialDate = { year: 2030, season: 1, week: 1 };
const command = { type: 'time.advance' };
const playerIds: Record<string, string> = { alice: '11111111-1111-4111-8111-111111111111', bob: '22222222-2222-4222-8222-222222222222' };

/** Models scope isolation and atomic creation at the external store boundary. */
class OwnerBoundMemory {
  readonly saves = new InMemorySave();
  readonly owners = new Map<string, string>();
  readonly names = new Map<string, string>();
  readonly players = new Map<string, PlayerProfileRecord>(Object.entries(playerIds).map(([name, id]) => [id, { id, name, createdAt: '2026-01-01T00:00:00.000Z' }]));
  readonly profiles: PlayerProfileStore = {
    list: async () => [...this.players.values()],
    get: async (id) => this.players.get(id.toLowerCase()) ?? null,
    create: async ({ id, name }) => { const existing = this.players.get(id); if (existing) return existing.name === name ? existing : null; const player = { id, name, createdAt: '2026-01-01T00:00:00.000Z' }; this.players.set(id, player); return player; },
    rename: async ({ id, name }) => { const previous = this.players.get(id); if (!previous) return null; const player = { ...previous, name }; this.players.set(id, player); return player; },
  };

  store(owner: string): CompanyStore {
    const owns = (companyId: string) => this.owners.get(companyId) === owner;
    return {
      listCompanies: async () => ({ kind: 'listed', companies: [...this.owners].filter(([, id]) => id === owner).map(([id]) => ({ id, name: this.names.get(id)!, date: this.saves.companies.get(id)!.state.calendar.date })) }),
      createCompany: async ({ companyId, name, state }) => {
        if (this.owners.has(companyId)) return { kind: 'not-created' };
        this.owners.set(companyId, owner);
        this.names.set(companyId, name);
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

async function start(database: OwnerBoundMemory): Promise<string> {
  const server = createApiServer({
    storeForOwner: (owner) => database.store(owner),
    playerProfiles: database.profiles,
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

async function call(base: string, path: string, options: { player?: string; body?: unknown; method?: string } = {}) {
  const response = await fetch(`${base}${path}`, {
    method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
    headers: {
      ...(options.player ? { 'x-winemaker-player-id': playerIds[options.player] ?? options.player } : {}),
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

async function create(base: string, companyId = 'vineyard') {
  return call(base, '/companies', { player: 'alice', body: { companyId, name: companyId } });
}

describe('company HTTP authority', () => {
  it('creates, lists and renames selectable players, and uses the new profile for companies', async () => {
    const database = new OwnerBoundMemory();
    const base = await start(database);
    const created = await call(base, '/players', { body: { id: '33333333-3333-4333-8333-333333333333', name: 'Clara' } });
    expect(created.status).toBe(201);
    const player = created.body.player as { id: string; name: string };
    expect(player.name).toBe('Clara');
    expect((await call(base, '/players')).body).toMatchObject({ kind: 'players-listed', players: expect.arrayContaining([expect.objectContaining(player)]) });
    expect((await call(base, `/players/${player.id}`, { method: 'PATCH', body: { name: 'Clara New' } })).body).toMatchObject({ kind: 'player-updated', player: { ...player, name: 'Clara New' } });
    expect((await call(base, '/companies', { player: player.id, body: { companyId: 'clara', name: 'Clara Estate' } })).status).toBe(201);
    expect((await call(base, '/companies', { player: player.id })).body).toMatchObject({ companies: [{ id: 'clara', name: 'Clara Estate' }] });
  });

  it('retries a player creation with the same ID without creating a duplicate or replacing another profile', async () => {
    const database = new OwnerBoundMemory();
    const base = await start(database);
    const id = '33333333-3333-4333-8333-333333333333';
    const first = await call(base, '/players', { body: { id, name: 'Clara' } });
    expect(first.status).toBe(201);
    expect(await call(base, '/players', { body: { id, name: 'Clara' } })).toEqual(first);
    expect((await call(base, '/players', { body: { id, name: 'Different' } })).status).toBe(409);
    expect(database.players.get(id)?.name).toBe('Clara');
  });

  it('rejects unknown, malformed, or ambiguous company scopes', async () => {
    const base = await start(new OwnerBoundMemory());
    for (const player of ['bad-id', '33333333-3333-4333-8333-333333333333']) {
      expect(await call(base, '/companies', { player })).toEqual({ status: 401, body: { kind: 'unauthorized' } });
    }
    const response = await fetch(`${base}/companies`, { headers: { 'x-winemaker-player-id': playerIds.alice, 'x-winemaker-unassigned': '1' } });
    expect(response.status).toBe(400);
  });

  it('shares unassigned companies without exposing companies belonging to a player', async () => {
    const database = new OwnerBoundMemory();
    const base = await start(database);
    await create(base, 'owned');
    const headers = { 'x-winemaker-unassigned': '1', 'content-type': 'application/json' };
    const created = await fetch(`${base}/companies`, { method: 'POST', headers, body: JSON.stringify({ companyId: 'unassigned', name: 'Open Winery' }) });
    expect(created.status).toBe(201);
    const listed = await fetch(`${base}/companies`, { headers });
    expect(await listed.json()).toMatchObject({ kind: 'listed', companies: [{ id: 'unassigned', name: 'Open Winery' }] });
    const hidden = await fetch(`${base}/companies/owned`, { headers });
    expect(hidden.status).toBe(404);
    const anotherClient = await fetch(`${base}/companies/unassigned`, { headers: { 'x-winemaker-unassigned': '1' } });
    expect(anotherClient.status).toBe(200);
  });

  it('scopes companies to an existing selected profile and makes other scopes look missing', async () => {
    const database = new OwnerBoundMemory();
    const base = await start(database);
    expect(await call(base, '/companies/vineyard')).toEqual({ status: 401, body: { kind: 'unauthorized' } });
    expect(await create(base)).toEqual({ status: 201, body: { kind: 'created' } });
    const hidden = await call(base, '/companies/vineyard', { player: 'bob' });
    const missing = await call(base, '/companies/nonexistent', { player: 'bob' });
    expect(hidden).toEqual(missing);
    expect(hidden).toEqual({ status: 404, body: { kind: 'missing' } });
    expect(await call(base, '/companies', { player: 'bob', body: { companyId: 'spoof', name: 'Spoof', ownerId: 'alice' } })).toEqual({ status: 400, body: { kind: 'invalid-input' } });
    expect(database.owners.has('spoof')).toBe(false);
    expect(await call(base, '/companies', { player: 'bob', body: { companyId: 'vineyard', name: 'Vineyard' } })).toEqual({ status: 409, body: { kind: 'not-created' } });
    expect(await call(base, '/companies', { player: 'bob', body: { companyId: 'bob-company', name: 'Bob Winery' } })).toEqual({ status: 201, body: { kind: 'created' } });
    expect(await call(base, '/companies/bob-company', { player: 'alice' })).toEqual({ status: 404, body: { kind: 'missing' } });
    expect((await call(base, '/companies/bob-company', { player: 'bob' })).body.kind).toBe('loaded');
    expect((await call(base, '/companies', { player: 'alice' })).body).toEqual({ kind: 'listed', companies: [{ id: 'vineyard', name: 'vineyard', date: initialDate }] });
    expect((await call(base, '/companies', { player: 'bob' })).body).toEqual({ kind: 'listed', companies: [{ id: 'bob-company', name: 'Bob Winery', date: initialDate }] });
  });

  it('uses trusted creation configuration and rejects client overrides or candidate state', async () => {
    const database = new OwnerBoundMemory();
    const base = await start(database);
    for (const override of [{ rules }, { initialDate }, { rules, initialDate }, { state: {} }]) {
      expect((await call(base, '/companies', { player: 'alice', body: { companyId: 'a', name: 'Winery', ...override } })).status).toBe(400);
    }
    expect((await call(base, '/companies', { player: 'alice', body: {} })).status).toBe(400);
    for (const name of ['', '  ', ' trailing ', 'x'.repeat(81)]) {
      expect((await call(base, '/companies', { player: 'alice', body: { companyId: 'a', name } })).status).toBe(400);
    }
    expect(database.owners.size).toBe(0);
    await create(base);
    expect((await call(base, '/companies/vineyard', { player: 'alice' })).body).toMatchObject({
      snapshot: { state: { calendar: { rules, date: initialDate } } },
    });
    const injected = await call(base, '/companies/vineyard/commands', {
      player: 'alice', body: { commandId: 'c1', expectedRevision: 0, command, next: { calendar: {} } },
    });
    expect(injected.status).toBe(400);
    const disguised = await call(base, '/companies/vineyard/commands', {
      player: 'alice', body: { commandId: 'c1', expectedRevision: 0, command: { ...command, next: {} } },
    });
    expect(disguised.status).toBe(400);
    expect(database.saves.companies.get('vineyard')?.revision).toBe(0);
  });

  it('commits valid commands, deduplicates retries without replaying events, and rejects stale revisions', async () => {
    const database = new OwnerBoundMemory();
    const base = await start(database);
    await create(base);
    const body = { commandId: 'advance-1', expectedRevision: 0, command };
    const first = await call(base, '/companies/vineyard/commands', { player: 'alice', body });
    expect(first.status).toBe(200);
    expect(first.body.kind).toBe('committed');
    expect(first.body.events).toHaveLength(1);
    expect(await call(base, '/companies/vineyard/commands', { player: 'alice', body })).toEqual({ status: 200, body: { kind: 'already-committed', revision: 1 } });
    expect(await call(base, '/companies/vineyard/commands', { player: 'alice', body: { ...body, commandId: 'advance-2' } })).toEqual({ status: 409, body: { kind: 'conflict', currentRevision: 1 } });
    expect(database.saves.writes).toBe(1);
    const loaded = await call(base, '/companies/vineyard', { player: 'alice' });
    expect(loaded.body).toMatchObject({ kind: 'loaded', snapshot: { revision: 1, state: { calendar: { date: { week: 2 } } } } });
  });

  it('serializes concurrent requests to the same company', async () => {
    const database = new OwnerBoundMemory();
    const base = await start(database);
    await create(base);
    const results = await Promise.all(['one', 'two'].map((commandId) => call(base, '/companies/vineyard/commands', {
      player: 'alice', body: { commandId, expectedRevision: 0, command },
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
      player: 'alice', body: { commandId: 'used', expectedRevision: 0, command },
    })).toEqual({ status: 409, body: { kind: 'command-id-mismatch' } });
    expect(database.saves.writes).toBe(0);
  });

  it('blocks further commands while an uncertain outcome is pending and resolves the original attempt', async () => {
    const database = new OwnerBoundMemory();
    const base = await start(database);
    await create(base);
    database.saves.nextCommit = 'commit-then-unknown';
    const body = { commandId: 'uncertain', expectedRevision: 0, command };
    expect(await call(base, '/companies/vineyard/commands', { player: 'alice', body })).toEqual({ status: 202, body: { kind: 'unknown', commandId: 'uncertain' } });
    expect(await call(base, '/companies/vineyard/commands', { player: 'alice', body: { ...body, commandId: 'other' } })).toEqual({ status: 409, body: { kind: 'blocked', reason: 'unresolved', pending: { commandId: 'uncertain' } } });
    expect((await call(base, '/companies/vineyard/resolve', { player: 'alice', body: { commandId: 'other' } })).status).toBe(400);
    database.saves.resolution = 'pending';
    expect(await call(base, '/companies/vineyard/resolve', { player: 'alice', body: { commandId: 'uncertain' } })).toEqual({ status: 202, body: { kind: 'pending' } });
    database.saves.resolution = 'normal';
    expect(await call(base, '/companies/vineyard/resolve', { player: 'alice', body: { commandId: 'uncertain' } })).toEqual({ status: 200, body: { kind: 'committed', revision: 1 } });
    expect(database.saves.writes).toBe(1);
  });

  it('fences a late attempt before reporting it did not commit', async () => {
    const database = new OwnerBoundMemory();
    const base = await start(database);
    await create(base);
    database.saves.nextCommit = 'late-unknown';
    await call(base, '/companies/vineyard/commands', { player: 'alice', body: { commandId: 'late', expectedRevision: 0, command } });
    expect(database.saves.lateAttempt?.attemptId).not.toBe('late');
    expect(await call(base, '/companies/vineyard/resolve', { player: 'alice', body: { commandId: 'late' } })).toEqual({ status: 200, body: { kind: 'not-committed' } });
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
    const delayed = call(first, '/companies/vineyard/commands', { player: 'alice', body: intent });
    await waiting;
    database.saves.beforeCommit = undefined;
    try {
      database.saves.nextCommit = 'reservation-then-unknown';
      expect((await call(second, '/companies/vineyard/commands', { player: 'alice', body: intent })).body.kind).toBe('unknown');
      expect((await call(second, '/companies/vineyard/resolve', { player: 'alice', body: { commandId: intent.commandId } })).body.kind).toBe('not-committed');
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
    expect((await call(base, '/companies/vineyard/commands', { player: 'alice', body: uncertain })).body.kind).toBe('unknown');
    expect(await call(base, '/companies/vineyard/commands', { player: 'alice', body: uncertain })).toEqual({
      status: 200, body: { kind: 'already-committed', revision: 1 },
    });
    expect((await call(base, '/companies/vineyard/commands', {
      player: 'alice', body: { commandId: 'next', expectedRevision: 1, command },
    })).body.kind).toBe('committed');
    expect(database.saves.writes).toBe(2);
  });

  it('discovers another instance’s durable reservation and blocks conflicting commands without leaking the attempt', async () => {
    const database = new OwnerBoundMemory();
    const first = await start(database);
    const second = await start(database);
    await create(first);
    await call(second, '/companies/vineyard', { player: 'alice' });

    let signalStarted!: () => void;
    let release!: () => void;
    const started = new Promise<void>((resolve) => { signalStarted = resolve; });
    const paused = new Promise<void>((resolve) => { release = resolve; });
    database.saves.beforeCommit = async () => { signalStarted(); await paused; };
    const competing = call(second, '/companies/vineyard/commands', {
      player: 'alice', body: { commandId: 'competing', expectedRevision: 0, command },
    });
    await started;
    database.saves.beforeCommit = undefined;
    database.saves.nextCommit = 'reservation-then-unknown';
    expect(await call(first, '/companies/vineyard/commands', {
      player: 'alice', body: { commandId: 'reserved', expectedRevision: 0, command },
    })).toEqual({ status: 202, body: { kind: 'unknown', commandId: 'reserved' } });
    release();

    expect(await competing).toEqual({
      status: 409, body: { kind: 'blocked', reason: 'unresolved', pending: { commandId: 'reserved' } },
    });
    const loaded = await call(second, '/companies/vineyard', { player: 'alice' });
    expect(loaded.body.pending).toEqual({ commandId: 'reserved' });
    expect(JSON.stringify(loaded.body)).not.toContain('attemptId');
    expect(JSON.stringify(loaded.body)).not.toContain('fingerprint');
    expect(await call(second, '/companies/vineyard', { player: 'bob' })).toEqual({ status: 404, body: { kind: 'missing' } });
  });

  it('recovers and fences a durable reservation after restart, allowing a new command', async () => {
    const database = new OwnerBoundMemory();
    const first = await start(database);
    await create(first);
    database.saves.nextCommit = 'reservation-then-unknown';
    expect((await call(first, '/companies/vineyard/commands', {
      player: 'alice', body: { commandId: 'late', expectedRevision: 0, command },
    })).status).toBe(202);
    await stop(running[0]);

    const restarted = await start(database);
    const loaded = await call(restarted, '/companies/vineyard', { player: 'alice' });
    expect(loaded.body.pending).toEqual({ commandId: 'late' });
    expect(await call(restarted, '/companies/vineyard/resolve', {
      player: 'bob', body: { commandId: 'late' },
    })).toEqual({ status: 404, body: { kind: 'missing' } });
    expect(await call(restarted, '/companies/vineyard/commands', {
      player: 'alice', body: { commandId: 'new', expectedRevision: 0, command },
    })).toEqual({ status: 409, body: { kind: 'blocked', reason: 'unresolved', pending: { commandId: 'late' } } });
    const resolution = { player: 'alice', body: { commandId: 'late' } };
    database.saves.resolution = 'pending';
    expect(await call(restarted, '/companies/vineyard/resolve', resolution)).toEqual({ status: 202, body: { kind: 'pending' } });
    database.saves.resolution = 'normal';
    expect(await call(restarted, '/companies/vineyard/resolve', resolution)).toEqual({ status: 200, body: { kind: 'not-committed' } });
    expect(database.saves.runLateAttempt().kind).toBe('failed');
    expect((await call(restarted, '/companies/vineyard/commands', {
      player: 'alice', body: { commandId: 'new', expectedRevision: 0, command },
    })).body.kind).toBe('committed');
  });

  it('replays a committed receipt while an unrelated durable attempt is pending', async () => {
    const database = new OwnerBoundMemory();
    const first = await start(database);
    const second = await start(database);
    await create(first);
    const already = { commandId: 'already', expectedRevision: 0, command };
    expect((await call(first, '/companies/vineyard/commands', { player: 'alice', body: already })).body.kind).toBe('committed');
    database.saves.nextCommit = 'reservation-then-unknown';
    await call(first, '/companies/vineyard/commands', {
      player: 'alice', body: { commandId: 'pending', expectedRevision: 1, command },
    });
    expect(await call(second, '/companies/vineyard/commands', { player: 'alice', body: already })).toEqual({
      status: 200, body: { kind: 'already-committed', revision: 1 },
    });
    expect((await call(second, '/companies/vineyard', { player: 'alice' })).body.pending).toEqual({ commandId: 'pending' });
  });

  it('resolves a receipt replay that could not initially refresh the snapshot', async () => {
    const database = new OwnerBoundMemory();
    const base = await start(database);
    await create(base);
    const body = { commandId: 'already', expectedRevision: 0, command };
    expect((await call(base, '/companies/vineyard/commands', { player: 'alice', body })).body.kind).toBe('committed');
    const load = database.saves.load.bind(database.saves);
    let reads = 0;
    database.saves.load = async (companyId) => {
      reads += 1;
      return reads === 3 ? { kind: 'unavailable', details: 'private database detail' } : load(companyId);
    };
    expect(await call(base, '/companies/vineyard/commands', { player: 'alice', body })).toEqual({
      status: 409, body: { kind: 'sync-required', commandId: 'already', load: { kind: 'unavailable' } },
    });
    expect((await call(base, '/companies/vineyard', { player: 'alice' })).body.pending).toEqual({ commandId: 'already' });
    expect(await call(base, '/companies/vineyard/resolve', {
      player: 'alice', body: { commandId: 'already' },
    })).toEqual({ status: 200, body: { kind: 'committed', revision: 1 } });
  });

  it('never treats an absent receipt after restart as proof of rollback', async () => {
    const database = new OwnerBoundMemory();
    const firstBase = await start(database);
    await create(firstBase);
    database.saves.nextCommit = 'late-unknown';
    await call(firstBase, '/companies/vineyard/commands', { player: 'alice', body: { commandId: 'late', expectedRevision: 0, command } });
    await stop(running[0]);
    const secondBase = await start(database);
    const resolution = { player: 'alice', body: { commandId: 'late' } };
    expect(await call(secondBase, '/companies/vineyard/resolve', resolution)).toEqual({ status: 202, body: { kind: 'pending', retry: 'original-command' } });
    expect(database.saves.runLateAttempt().kind).toBe('committed');
    expect(await call(secondBase, '/companies/vineyard/resolve', resolution)).toEqual({ status: 200, body: { kind: 'committed', revision: 1 } });
  });

  it('does not report an unavailable or malformed receipt as a resolved command', async () => {
    const database = new OwnerBoundMemory();
    const base = await start(database);
    await create(base);
    const resolution = { player: 'alice', body: { commandId: 'lost' } };
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
    expect((await call(base, '/companies', { player: 'alice', body: { data: 'x'.repeat(20_000) } })).status).toBe(413);
    database.saves.loadOverrides.set('vineyard', { kind: 'unavailable', details: 'private database credentials' });
    expect(await call(base, '/companies/vineyard', { player: 'alice' })).toEqual({ status: 503, body: { kind: 'unavailable' } });
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
      storeForOwner: (owner) => new OwnerBoundMemory().store(owner),
      playerProfiles: new OwnerBoundMemory().profiles,
      newCompany: { rules, initialDate: { ...initialDate, week: 4 } },
    })).toThrow('Invalid company startup configuration.');
  });
});
