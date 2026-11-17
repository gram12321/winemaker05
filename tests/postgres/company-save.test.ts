import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg, { type Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createCompanyState, decideCommand, type CompanyState } from '../../src/game/core';
import type { CompanySavePort } from '../../src/authority/contracts';
import { PostgresCompanySavePort } from '../../src/server/postgres';

// Only the fresh disposable database authorized for this task may be used.
const databaseUrl = process.env.WINEMAKER_POSTGRES_TEST_DATABASE_URL;
const suite = describe.skipIf(!databaseUrl);
const ownerId = `wm05-test-owner-${randomUUID()}`;
const otherOwnerId = `wm05-test-owner-${randomUUID()}`;

function state(): CompanyState {
  const result = createCompanyState({
    rules: { weeksPerSeason: 12, seasonsPerYear: 4 },
    initialDate: { year: 2030, season: 2, week: 3 },
  });
  if (result.kind !== 'created') throw new Error(result.reasons.join(' '));
  return result.state;
}

function advance(previous: CompanyState): CompanyState {
  const result = decideCommand(previous, { type: 'time.advance' });
  if (result.kind !== 'accepted') throw new Error(result.reasons.join(' '));
  return result.next;
}

function candidate(companyId: string, commandId: string, attemptId: string, options?: {
  expectedRevision?: number;
  fingerprint?: string;
  next?: CompanyState;
}): Parameters<CompanySavePort['commit']>[0] {
  const expectedRevision = options?.expectedRevision ?? 0;
  return {
    companyId,
    attemptId,
    expectedRevision,
    next: options?.next ?? advance(state()),
    receipt: {
      companyId,
      commandId,
      fingerprint: options?.fingerprint ?? '{"type":"time.advance"}',
      revision: expectedRevision + 1,
    },
  };
}

function resolution(input: Parameters<CompanySavePort['commit']>[0]): Parameters<CompanySavePort['resolveAttempt']>[0] {
  return {
    companyId: input.companyId,
    commandId: input.receipt.commandId,
    fingerprint: input.receipt.fingerprint,
    attemptId: input.attemptId,
  };
}

/** Drop only the response to a real, acknowledged transaction commit. */
function loseCommitResponse(pool: Pool, commitNumber = 1): Pool {
  let commits = 0;
  return new Proxy(pool, {
    get(target, property) {
      if (property === 'connect') return async () => {
        const client = await target.connect();
        return new Proxy(client, {
          get(inner, key) {
            if (key === 'query') return (...args: unknown[]) => {
              const result: unknown = Reflect.apply(inner.query, inner, args);
              if (args[0] === 'COMMIT' && ++commits === commitNumber) {
                return Promise.resolve(result).then(() => { throw new Error('Injected lost response'); });
              }
              return result;
            };
            const value: unknown = Reflect.get(inner, key, inner);
            return typeof value === 'function' ? value.bind(inner) : value;
          },
        }) as PoolClient;
      };
      const value: unknown = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as Pool;
}

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

/** Hold an actual request before it starts, or after its reservation commits. */
function pauseFirstTransaction(pool: Pool, when: 'begin' | 'reservation-commit') {
  const started = deferred();
  const gate = deferred();
  let paused = false;
  const wrapped = new Proxy(pool, {
    get(target, property) {
      if (property === 'connect') return async () => {
        const client = await target.connect();
        return new Proxy(client, {
          get(inner, key) {
            if (key === 'query') return async (...args: unknown[]) => {
              if (!paused && when === 'begin' && args[0] === 'BEGIN') {
                paused = true;
                started.release();
                await gate.promise;
              }
              const result: unknown = await Reflect.apply(inner.query, inner, args);
              if (!paused && when === 'reservation-commit' && args[0] === 'COMMIT') {
                paused = true;
                started.release();
                await gate.promise;
              }
              return result;
            };
            const value: unknown = Reflect.get(inner, key, inner);
            return typeof value === 'function' ? value.bind(inner) : value;
          },
        }) as PoolClient;
      };
      const value: unknown = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as Pool;
  return { pool: wrapped, started: started.promise, release: gate.release };
}

/** Fail after the candidate state UPDATE, before inserting its receipt. */
function failReceiptInsert(pool: Pool): Pool {
  return new Proxy(pool, {
    get(target, property) {
      if (property === 'connect') return async () => {
        const client = await target.connect();
        return new Proxy(client, {
          get(inner, key) {
            if (key === 'query') return (...args: unknown[]) => {
              if (typeof args[0] === 'string' && args[0].includes('INSERT INTO winemaker05_private.command_receipts')) {
                return Promise.reject(new Error('Injected failure after state update'));
              }
              return Reflect.apply(inner.query, inner, args) as unknown;
            };
            const value: unknown = Reflect.get(inner, key, inner);
            return typeof value === 'function' ? value.bind(inner) : value;
          },
        }) as PoolClient;
      };
      const value: unknown = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as Pool;
}

suite('PostgresCompanySavePort (real PostgreSQL)', () => {
  let pool: Pool;
  let owner: PostgresCompanySavePort;
  let other: PostgresCompanySavePort;

  beforeAll(async () => {
    if (databaseUrl !== 'postgresql://winemaker_test@127.0.0.1:55439/winemaker05_durable_test') {
      throw new Error('Use only the authorized disposable winemaker05_durable_test database.');
    }
    pool = new pg.Pool({ connectionString: databaseUrl });
    const existing = await pool.query<{ schema_name: string | null }>(
      `SELECT to_regnamespace('winemaker05_private')::text AS schema_name`,
    );
    if (!existing.rows[0]?.schema_name) {
      const schema = fileURLToPath(new URL('../../src/server/postgres/schema.sql', import.meta.url));
      await pool.query(await readFile(schema, 'utf8'));
    }
    owner = new PostgresCompanySavePort(pool, ownerId);
    other = new PostgresCompanySavePort(pool, otherOwnerId);
  });

  afterAll(async () => {
    if (!pool) return;
    try {
      await pool.query(`DELETE FROM winemaker05_private.company_saves WHERE owner_id = ANY($1::text[])`, [[ownerId, otherOwnerId]]);
    } finally {
      await pool.end();
    }
  });

  it('keeps tables private to the server role with RLS enabled and no client policies', async () => {
    const schema = await pool.query<{ public_usage: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM pg_namespace n,
          LATERAL aclexplode(COALESCE(n.nspacl, acldefault('n', n.nspowner))) acl
        WHERE n.nspname = 'winemaker05_private' AND acl.grantee = 0 AND acl.privilege_type = 'USAGE'
      ) AS public_usage`,
    );
    expect(schema.rows[0]?.public_usage).toBe(false);
    const tables = await pool.query<{ relname: string; relrowsecurity: boolean; policies: number }>(
      `SELECT c.relname, c.relrowsecurity,
        (SELECT COUNT(*)::integer FROM pg_policy p WHERE p.polrelid = c.oid) AS policies
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'winemaker05_private' AND c.relkind = 'r' ORDER BY c.relname`,
    );
    expect(tables.rows).toEqual([
      { relname: 'attempt_fences', relrowsecurity: true, policies: 0 },
      { relname: 'command_receipts', relrowsecurity: true, policies: 0 },
      { relname: 'company_saves', relrowsecurity: true, policies: 0 },
      { relname: 'pending_attempts', relrowsecurity: true, policies: 0 },
    ]);
  });

  it('creates explicitly without overwriting a collision and scopes every operation to the authenticated owner', async () => {
    const companyId = randomUUID();
    const input = candidate(companyId, randomUUID(), randomUUID());
    expect(await owner.createCompany({ companyId, state: state() })).toEqual({ kind: 'created' });
    expect(await owner.createCompany({ companyId, state: advance(state()) })).toEqual({ kind: 'not-created' });
    expect(await other.createCompany({ companyId, state: advance(state()) })).toEqual({ kind: 'not-created' });
    expect(await other.load(companyId)).toEqual({ kind: 'missing' });
    expect(await other.getReceipt(companyId, input.receipt.commandId)).toEqual({ kind: 'absent' });
    expect((await other.commit(input)).kind).toBe('failed');
    expect((await other.resolveAttempt(resolution(input))).kind).toBe('unavailable');
    const loaded = await owner.load(companyId);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind === 'loaded') expect(loaded.snapshot.state).toEqual(state());

    expect(await owner.commit(input)).toEqual({ kind: 'committed' });
    expect(await other.getReceipt(companyId, input.receipt.commandId)).toEqual({ kind: 'absent' });
    expect((await other.resolveAttempt(resolution(input))).kind).toBe('unavailable');
  });

  it('serializes different writers and returns one conflict without overwriting the winner', async () => {
    const companyId = randomUUID();
    await owner.createCompany({ companyId, state: state() });
    const first = candidate(companyId, 'first', 'attempt-first');
    const second = candidate(companyId, 'second', 'attempt-second', { next: advance(advance(state())) });
    const results = await Promise.all([owner.commit(first), owner.commit(second)]);
    expect(results.filter((result) => result.kind === 'committed')).toHaveLength(1);
    expect(['conflict', 'pending']).toContain(results.find((result) => result.kind !== 'committed')?.kind);
    const winner = results[0]?.kind === 'committed' ? first : second;
    const loser = winner === first ? second : first;
    const loaded = await owner.load(companyId);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind === 'loaded') {
      expect(loaded.snapshot.revision).toBe(1);
      expect(loaded.snapshot.state).toEqual(winner.next);
    }
    expect((await owner.getReceipt(companyId, winner.receipt.commandId)).kind).toBe('found');
    expect(await owner.getReceipt(companyId, loser.receipt.commandId)).toEqual({ kind: 'absent' });
  });

  it('returns the original receipt before checking a stale replay or a different payload', async () => {
    const companyId = randomUUID();
    await owner.createCompany({ companyId, state: state() });
    const first = candidate(companyId, 'stable-command', 'attempt-one');
    expect(await owner.commit(first)).toEqual({ kind: 'committed' });
    const replay = candidate(companyId, 'stable-command', 'attempt-two', {
      expectedRevision: 1,
      next: { calendar: null } as unknown as CompanyState,
    });
    expect(await owner.commit(replay)).toEqual({ kind: 'already-committed', receipt: first.receipt });
    expect(await owner.commit(candidate(companyId, 'stable-command', 'attempt-three', { fingerprint: 'different' })))
      .toEqual({ kind: 'command-id-mismatch' });
    const loaded = await owner.load(companyId);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind === 'loaded') expect(loaded.snapshot.revision).toBe(1);
  });

  it('resolves a lost commit response as the one durable receipt', async () => {
    const companyId = randomUUID();
    await owner.createCompany({ companyId, state: state() });
    const input = candidate(companyId, randomUUID(), randomUUID());
    const lostResponse = new PostgresCompanySavePort(loseCommitResponse(pool, 2), ownerId);
    expect(await lostResponse.commit(input)).toEqual({ kind: 'unknown' });
    expect(await owner.resolveAttempt(resolution(input))).toEqual({ kind: 'committed', receipt: input.receipt });
    const loaded = await owner.load(companyId);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind === 'loaded') expect(loaded.snapshot.revision).toBe(1);
  });

  it('recovers a lost reservation response across ports and fences its delayed retry', async () => {
    const companyId = randomUUID();
    await owner.createCompany({ companyId, state: state() });
    const input = candidate(companyId, 'reservation', 'original');
    const lost = new PostgresCompanySavePort(loseCommitResponse(pool), ownerId);
    expect(await lost.commit(input)).toEqual({ kind: 'unknown' });
    const restarted = new PostgresCompanySavePort(pool, ownerId);
    const loaded = await restarted.load(companyId);
    expect(loaded).toMatchObject({ kind: 'loaded', snapshot: { revision: 0 }, pending: resolution(input) });
    expect((await other.load(companyId)).kind).toBe('missing');
    expect((await other.resolveAttempt(resolution(input))).kind).toBe('unavailable');
    expect(await restarted.commit(candidate(companyId, 'different', 'other-attempt'))).toEqual({ kind: 'pending', pending: resolution(input) });
    expect(await restarted.getReceipt(companyId, input.receipt.commandId)).toEqual({ kind: 'absent' });
    expect(await restarted.resolveAttempt(resolution(input))).toEqual({ kind: 'not-committed' });
    expect((await owner.commit(input)).kind).toBe('failed');
    expect((await restarted.commit(candidate(companyId, 'different', 'fresh-attempt'))).kind).toBe('committed');
  });

  it('keeps a lost fence acknowledgement uncertain while the durable fence prevents continuation', async () => {
    const companyId = randomUUID();
    await owner.createCompany({ companyId, state: state() });
    const input = candidate(companyId, 'reserved', 'attempt');
    expect((await new PostgresCompanySavePort(loseCommitResponse(pool), ownerId).commit(input)).kind).toBe('unknown');
    const lostFence = new PostgresCompanySavePort(loseCommitResponse(pool), ownerId);
    expect((await lostFence.resolveAttempt(resolution(input))).kind).toBe('unavailable');
    expect((await owner.commit(input)).kind).toBe('failed');
    expect(await owner.resolveAttempt(resolution(input))).toEqual({ kind: 'not-committed' });
    const loaded = await owner.load(companyId);
    expect(loaded).toMatchObject({ kind: 'loaded', snapshot: { revision: 0 } });
    if (loaded.kind === 'loaded') expect(loaded.pending).toBeUndefined();
  });

  it('rolls back a partial state write and retains its reservation for explicit recovery', async () => {
    const companyId = randomUUID();
    await owner.createCompany({ companyId, state: state() });
    const input = candidate(companyId, 'partial', 'attempt');
    expect((await new PostgresCompanySavePort(failReceiptInsert(pool), ownerId).commit(input)).kind).toBe('unknown');
    const loaded = await owner.load(companyId);
    expect(loaded).toMatchObject({ kind: 'loaded', snapshot: { revision: 0, state: state() }, pending: resolution(input) });
    expect(await owner.getReceipt(companyId, 'partial')).toEqual({ kind: 'absent' });
    expect(await owner.resolveAttempt(resolution(input))).toEqual({ kind: 'not-committed' });
    expect((await owner.commit(input)).kind).toBe('failed');
  });

  it('does not claim failure for a duplicate attempt when storage cannot be contacted', async () => {
    const companyId = randomUUID();
    await owner.createCompany({ companyId, state: state() });
    const input = candidate(companyId, 'running', 'attempt');
    const pause = pauseFirstTransaction(pool, 'reservation-commit');
    const running = new PostgresCompanySavePort(pause.pool, ownerId).commit(input);
    await pause.started;
    const unavailablePool = new Proxy(pool, {
      get(target, property) {
        if (property === 'connect') return async () => { throw new Error('connection lost'); };
        const value: unknown = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as Pool;
    try {
      expect(await new PostgresCompanySavePort(unavailablePool, ownerId).commit(input)).toEqual({ kind: 'unknown' });
    } finally {
      pause.release();
    }
    expect(await running).toEqual({ kind: 'committed' });
  });

  it('keeps a healthy reservation while rejecting a competing intent and replaying an older receipt', async () => {
    const companyId = randomUUID();
    await owner.createCompany({ companyId, state: state() });
    const old = candidate(companyId, 'old', 'old-attempt');
    expect((await owner.commit(old)).kind).toBe('committed');
    const input = candidate(companyId, 'running', 'running-attempt', { expectedRevision: 1, next: advance(advance(state())) });
    const pause = pauseFirstTransaction(pool, 'reservation-commit');
    const running = new PostgresCompanySavePort(pause.pool, ownerId).commit(input);
    await pause.started;
    try {
      expect(await owner.commit(candidate(companyId, 'other', 'other-attempt', { expectedRevision: 1 })))
        .toEqual({ kind: 'pending', pending: resolution(input) });
      expect(await owner.commit(candidate(companyId, 'old', 'replay', { expectedRevision: 1 })))
        .toEqual({ kind: 'already-committed', receipt: old.receipt });
      expect(await owner.resolveAttempt(resolution(candidate(companyId, 'late', 'late-attempt')))).toEqual({ kind: 'not-committed' });
      const loaded = await owner.load(companyId);
      expect(loaded).toMatchObject({ kind: 'loaded', snapshot: { revision: 1 }, pending: resolution(input) });
      const fences = await pool.query(`SELECT attempt_id FROM winemaker05_private.attempt_fences WHERE company_id = $1 AND owner_id = $2 AND attempt_id = $3`, [companyId, ownerId, 'late-attempt']);
      expect(fences.rows).toEqual([{ attempt_id: 'late-attempt' }]);
    } finally {
      pause.release();
    }
    expect(await running).toEqual({ kind: 'committed' });
    expect(await owner.resolveAttempt(resolution(input))).toEqual({ kind: 'committed', receipt: input.receipt });
  });

  it('fences a request before its reservation transaction begins', async () => {
    const companyId = randomUUID();
    await owner.createCompany({ companyId, state: state() });
    const input = candidate(companyId, 'late', 'late-attempt');
    const pause = pauseFirstTransaction(pool, 'begin');
    const late = new PostgresCompanySavePort(pause.pool, ownerId).commit(input);
    await pause.started;
    try {
      expect(await owner.resolveAttempt(resolution(input))).toEqual({ kind: 'not-committed' });
    } finally {
      pause.release();
    }
    expect((await late).kind).toBe('failed');
    expect(await owner.getReceipt(companyId, 'late')).toEqual({ kind: 'absent' });
  });

  it('fences all deliveries of a canceled command and allows a new decision', async () => {
    const companyId = randomUUID();
    await owner.createCompany({ companyId, state: state() });
    const late = candidate(companyId, 'command', 'late-attempt');
    expect(await owner.resolveAttempt(resolution(late))).toEqual({ kind: 'not-committed' });
    expect((await owner.commit(late)).kind).toBe('failed');
    expect(await owner.getReceipt(companyId, 'command')).toEqual({ kind: 'absent' });
    expect((await owner.commit(candidate(companyId, 'command', 'fresh-attempt'))).kind).toBe('failed');
    expect(await owner.commit(candidate(companyId, 'new-command', 'new-attempt'))).toEqual({ kind: 'committed' });
    expect((await owner.commit(late)).kind).toBe('failed');
  });

  it('cancels another reservation for the same intent when fencing a delayed delivery', async () => {
    const companyId = randomUUID();
    await owner.createCompany({ companyId, state: state() });
    const active = candidate(companyId, 'shared-command', 'active-attempt');
    const late = candidate(companyId, 'shared-command', 'late-attempt');
    const pause = pauseFirstTransaction(pool, 'reservation-commit');
    const running = new PostgresCompanySavePort(pause.pool, ownerId).commit(active);
    await pause.started;
    try {
      expect(await owner.resolveAttempt(resolution(late))).toEqual({ kind: 'not-committed' });
      const loaded = await owner.load(companyId);
      expect(loaded.kind === 'loaded' && loaded.pending).toBeUndefined();
    } finally {
      pause.release();
    }
    expect((await running).kind).toBe('failed');
    expect((await owner.commit(late)).kind).toBe('failed');
    expect(await owner.getReceipt(companyId, 'shared-command')).toEqual({ kind: 'absent' });
  });

  it('does not cancel a competing payload that reused the command ID', async () => {
    const companyId = randomUUID();
    await owner.createCompany({ companyId, state: state() });
    const active = candidate(companyId, 'shared-command', 'active-attempt', { fingerprint: 'first-payload' });
    const other = candidate(companyId, 'shared-command', 'other-attempt', { fingerprint: 'different-payload' });
    const pause = pauseFirstTransaction(pool, 'reservation-commit');
    const running = new PostgresCompanySavePort(pause.pool, ownerId).commit(active);
    await pause.started;
    try {
      expect(await owner.resolveAttempt(resolution(other))).toEqual({ kind: 'pending' });
      expect(await owner.load(companyId)).toMatchObject({ kind: 'loaded', pending: resolution(active) });
    } finally {
      pause.release();
    }
    expect(await running).toEqual({ kind: 'committed' });
    expect(await owner.resolveAttempt(resolution(other))).toEqual({ kind: 'command-id-mismatch', receipt: active.receipt });
  });

  it('returns unavailable if a fence commit response is lost even when the fence was saved', async () => {
    const companyId = randomUUID();
    await owner.createCompany({ companyId, state: state() });
    const late = candidate(companyId, 'command', 'attempt');
    const lostResponse = new PostgresCompanySavePort(loseCommitResponse(pool), ownerId);
    expect((await lostResponse.resolveAttempt(resolution(late))).kind).toBe('unavailable');
    expect((await owner.commit(late)).kind).toBe('failed');
    expect(await owner.resolveAttempt(resolution(late))).toEqual({ kind: 'not-committed' });
  });

  it('durably fences a mismatched attempt before reporting the conflicting command receipt', async () => {
    const companyId = randomUUID();
    await owner.createCompany({ companyId, state: state() });
    const winner = candidate(companyId, 'same-command', 'winner', { fingerprint: 'first-payload' });
    const loser = candidate(companyId, 'same-command', 'late-loser', { fingerprint: 'different-payload' });
    expect(await owner.commit(winner)).toEqual({ kind: 'committed' });
    expect(await owner.resolveAttempt(resolution(loser))).toEqual({ kind: 'command-id-mismatch', receipt: winner.receipt });
    const fences = await pool.query<{ command_id: string; fingerprint: string }>(
      `SELECT command_id, fingerprint FROM winemaker05_private.attempt_fences
       WHERE company_id = $1 AND owner_id = $2 AND attempt_id = $3`,
      [companyId, ownerId, loser.attemptId],
    );
    expect(fences.rows).toEqual([{ command_id: 'same-command', fingerprint: 'different-payload' }]);
    expect(await owner.commit(loser)).toEqual({ kind: 'command-id-mismatch' });
  });

  it('preserves invalid records and refuses direct commits over them', async () => {
    const invalidId = randomUUID();
    await owner.createCompany({ companyId: invalidId, state: state() });
    const invalidState = { calendar: { rules: 'invalid' }, evidence: 'keep' };
    await pool.query(`UPDATE winemaker05_private.company_saves SET state = $2::jsonb WHERE company_id = $1`,
      [invalidId, JSON.stringify(invalidState)]);
    expect((await owner.load(invalidId)).kind).toBe('invalid');
    expect((await owner.commit(candidate(invalidId, 'command', 'attempt'))).kind).toBe('failed');
    expect(await owner.createCompany({ companyId: invalidId, state: state() })).toEqual({ kind: 'not-created' });
    const saved = await pool.query<{ state: unknown; revision: string }>(
      `SELECT state, revision FROM winemaker05_private.company_saves WHERE company_id = $1`,
      [invalidId],
    );
    expect(saved.rows[0]).toMatchObject({ state: invalidState, revision: '0' });
  });

  it('requires valid initial state and cannot overflow JavaScript-safe revisions', async () => {
    const companyId = randomUUID();
    expect((await owner.createCompany({ companyId, state: {} as CompanyState })).kind).toBe('invalid');
    expect(await owner.load(companyId)).toEqual({ kind: 'missing' });
    await owner.createCompany({ companyId, state: state() });
    await pool.query(`UPDATE winemaker05_private.company_saves SET revision = 9007199254740991 WHERE company_id = $1`, [companyId]);
    const oldInput = candidate(companyId, 'old', 'old-attempt');
    expect(await owner.commit(oldInput)).toEqual({ kind: 'conflict', currentRevision: Number.MAX_SAFE_INTEGER });
    const overflow = candidate(companyId, 'overflow', 'overflow-attempt', { expectedRevision: Number.MAX_SAFE_INTEGER });
    expect((await owner.commit(overflow)).kind).toBe('failed');
    const loaded = await owner.load(companyId);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind === 'loaded') expect(loaded.snapshot.revision).toBe(Number.MAX_SAFE_INTEGER);
  });
});
