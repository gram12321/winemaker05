import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import pg, { type Pool } from 'pg';
import { createApiServer } from '../../src/server/api/server';
import { PostgresCompanySavePort, PostgresPlayerProfileStore } from '../../src/server/postgres';

const databaseUrl = process.env.WINEMAKER_E2E_POSTGRES_TEST_DATABASE_URL;
const expectedDatabase = 'postgresql://winemaker_test@127.0.0.1:55439/winemaker05_browser_test';
const expectedOrigin = 'http://127.0.0.1:55440';
const playerName = `Browser Test ${randomUUID()}`;
let pool: Pool | undefined;
let server: Server | undefined;

test.describe('browser through the local PostgreSQL authority', () => {
  test.skip(!databaseUrl, 'Requires the explicitly configured disposable PostgreSQL browser test database.');

  test.beforeAll(async () => {
    if (databaseUrl !== expectedDatabase || process.env.WINEMAKER_AUTHORITY_ORIGIN !== expectedOrigin) {
      throw new Error('Use only the isolated browser test database and authority origin.');
    }
    pool = new pg.Pool({ connectionString: databaseUrl });
    const existing = await pool.query<{ schema_name: string | null }>("SELECT to_regnamespace('winemaker05_private')::text AS schema_name");
    if (!existing.rows[0]?.schema_name) {
      const schema = fileURLToPath(new URL('../../src/server/postgres/schema.sql', import.meta.url));
      await pool.query(await readFile(schema, 'utf8'));
    }
    const testPool = pool;
    server = createApiServer({
      storeForOwner: ownerId => new PostgresCompanySavePort(testPool, ownerId),
      playerProfiles: new PostgresPlayerProfileStore(testPool),
      newCompany: { rules: { weeksPerSeason: 12, seasonsPerYear: 4 }, initialDate: { year: 1, season: 1, week: 1 } },
    });
    server.listen(55440, '127.0.0.1');
    await once(server, 'listening');
  });

  test.afterAll(async () => {
    if (server) {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
    }
    if (pool) {
      try {
        await pool.query("DELETE FROM winemaker05_private.company_saves WHERE owner_id IN (SELECT 'player:' || player_id::text FROM winemaker05_private.player_profiles WHERE player_name = $1)", [playerName]);
        await pool.query('DELETE FROM winemaker05_private.player_profiles WHERE player_name = $1', [playerName]);
      } finally { await pool.end(); }
    }
  });

  test('creates a player and company, advances time, and reloads the committed state', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New User' }).click();
    await page.getByLabel('User Name').fill(playerName);
    await page.getByRole('button', { name: 'Create User' }).click();
    await page.getByLabel('Company Name').fill('Browser Winery');
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(page.getByLabel('Calendar')).toContainText('Week 1');
    await page.getByRole('button', { name: 'Advance Time' }).click();
    await expect(page.getByLabel('Calendar')).toContainText('Week 2');
    await page.reload();
    await expect(page.getByLabel('Calendar')).toContainText('Week 2');
    await page.getByRole('button', { name: 'Log out' }).click();
    await page.getByRole('button', { name: new RegExp(playerName) }).click();
    await page.getByRole('button', { name: /Browser Winery/ }).click();
    await expect(page.getByLabel('Calendar')).toContainText('Week 2');
  });
});
