import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import pg, { type Pool, type PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApiServer } from '../../src/server/api/server';
import { PostgresCompanySavePort } from '../../src/server/postgres';

// Opt in to a separate disposable local database; never use application data.
const databaseUrl = process.env.WINEMAKER_HTTP_POSTGRES_TEST_DATABASE_URL;
const suite = describe.skipIf(!databaseUrl);
const owner = `integration-owner-${randomUUID()}`;
const otherOwner = `integration-other-${randomUUID()}`;
const newCompany = {
  rules: { weeksPerSeason: 3, seasonsPerYear: 4 },
  initialDate: { year: 2030, season: 1, week: 1 },
};
const command = { type: 'time.advance' };
const servers: Server[] = [];

/** Allow the real first transaction to commit, then lose its response. */
function loseFirstCommitResponse(pool: Pool): Pool {
  let lost = false;
  return new Proxy(pool, {
    get(target, property) {
      if (property === 'connect') return async () => {
        const client = await target.connect();
        return new Proxy(client, {
          get(inner, key) {
            if (key === 'query') return (...args: unknown[]) => {
              const result: unknown = Reflect.apply(inner.query, inner, args);
              if (args[0] === 'COMMIT' && !lost) {
                lost = true;
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

async function start(pool: Pool): Promise<string> {
  const server = createApiServer({
    authenticate: async (header) => header === 'Bearer owner' ? owner : header === 'Bearer other' ? otherOwner : null,
    storeForOwner: (principal) => new PostgresCompanySavePort(pool, principal),
    newCompany,
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  servers.push(server);
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

async function call(base: string, path: string, token: string, body?: unknown) {
  const response = await fetch(`${base}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

suite('HTTP authority and real PostgreSQL', () => {
  let pool: Pool;

  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || !/test/i.test(url.pathname)) {
      throw new Error('Use a disposable local test database for HTTP integration tests.');
    }
    pool = new pg.Pool({ connectionString: databaseUrl });
    const existing = await pool.query<{ schema_name: string | null }>('SELECT to_regnamespace(\'winemaker05_private\')::text AS schema_name');
    if (!existing.rows[0]?.schema_name) {
      const schema = fileURLToPath(new URL('../../src/server/postgres/schema.sql', import.meta.url));
      await pool.query(await readFile(schema, 'utf8'));
    }
  });

  afterEach(async () => {
    for (const server of servers.splice(0)) {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  afterAll(async () => {
    if (!pool) return;
    try {
      await pool.query('DELETE FROM winemaker05_private.company_saves WHERE owner_id = ANY($1::text[])', [[owner, otherOwner]]);
    } finally {
      await pool.end();
    }
  });

  it('creates, authorizes, commits and deduplicates through the real store', async () => {
    const base = await start(pool);
    const company = randomUUID();
    expect(await call(base, '/companies', 'owner', { companyId: company })).toEqual({ status: 201, body: { kind: 'created' } });
    expect(await call(base, `/companies/${company}`, 'other')).toEqual({ status: 404, body: { kind: 'missing' } });
    const intent = { commandId: 'first', expectedRevision: 0, command };
    const first = await call(base, `/companies/${company}/commands`, 'owner', intent);
    expect(first.body).toMatchObject({ kind: 'committed', revision: 1 });
    expect(await call(base, `/companies/${company}/commands`, 'owner', intent)).toEqual({ status: 200, body: { kind: 'already-committed', revision: 1 } });
    expect((await call(base, `/companies/${company}`, 'owner')).body).toMatchObject({
      kind: 'loaded', snapshot: { revision: 1, state: { calendar: { date: { week: 2 } } } },
    });
  });

  it('recovers a durable uncertain reservation after switching HTTP instances', async () => {
    const firstBase = await start(loseFirstCommitResponse(pool));
    const company = randomUUID();
    expect((await call(firstBase, '/companies', 'owner', { companyId: company })).status).toBe(201);
    const pending = { commandId: 'uncertain', expectedRevision: 0, command };
    expect(await call(firstBase, `/companies/${company}/commands`, 'owner', pending)).toEqual({
      status: 202, body: { kind: 'unknown', commandId: 'uncertain' },
    });

    const secondBase = await start(pool);
    const blocked = await call(secondBase, `/companies/${company}/commands`, 'owner', { ...pending, commandId: 'other' });
    expect(blocked).toMatchObject({ status: 409, body: { kind: 'blocked', reason: 'unresolved' } });
    const resolved = await call(secondBase, `/companies/${company}/resolve`, 'owner', { commandId: 'uncertain' });
    expect(resolved).toEqual({ status: 200, body: { kind: 'not-committed' } });
    expect((await call(secondBase, `/companies/${company}/commands`, 'owner', pending)).body).toMatchObject({ kind: 'failed' });
    expect((await call(secondBase, `/companies/${company}/commands`, 'owner', { ...pending, commandId: 'new-decision' })).body).toMatchObject({ kind: 'committed', revision: 1 });
  });
});
