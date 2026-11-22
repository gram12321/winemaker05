import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import pg, { type Pool } from 'pg';
import { createApiServer } from '../../src/server/api/server';
import { PostgresCompanySavePort, PostgresPlayerProfileStore } from '../../src/server/postgres';
import type { CompanySnapshot } from '../../src/authority/contracts';

const databaseUrl = process.env.WINEMAKER_E2E_POSTGRES_TEST_DATABASE_URL;
const expectedDatabase = 'postgresql://winemaker_test@127.0.0.1:55439/winemaker05_browser_test';
const expectedOrigin = 'http://127.0.0.1:55440';
const playerName = `Browser Test ${randomUUID()}`;
let pool: Pool | undefined;
let server: Server | undefined;

async function advanceWeek(page: Page) {
  const calendar = page.getByLabel('Calendar');
  const before = await calendar.innerText();
  const advance = page.getByRole('button', { name: 'Advance time', exact: true });
  await expect(advance).toBeEnabled();
  await advance.click();
  await expect(calendar).not.toHaveText(before);
  await expect(advance).toBeEnabled();
}

async function savedCompany(companyId: string, profileId: string): Promise<CompanySnapshot> {
  const response = await fetch(`${expectedOrigin}/companies/${companyId}`, { headers: { 'x-winemaker-player-id': profileId } });
  const value = await response.json() as { kind: string; snapshot: CompanySnapshot };
  expect(value.kind).toBe('loaded');
  return value.snapshot;
}

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
    await expect(page.getByRole('heading', { name: /My Companies/ })).toBeVisible();
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

  test('plays the vineyard-to-sale loop and fulfills a contract through the real authority', async ({ page }) => {
    test.setTimeout(180_000);
    const profileId = randomUUID();
    const created = await fetch(`${expectedOrigin}/players`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: profileId, name: playerName }) });
    expect(created.status).toBe(201);
    await page.addInitScript(id => localStorage.setItem('winemaker05.selectedPlayer', id), profileId);
    await page.goto('/');
    await page.getByLabel('Company Name').fill('Core Loop Browser Winery');
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(page.getByLabel('Calendar')).toBeVisible();
    await page.getByLabel('Vineyard name', { exact: true }).fill('Browser North slope');
    await page.getByLabel('Area (hectares)', { exact: true }).fill('0.1');
    await page.getByRole('button', { name: 'Establish vineyard', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Browser North slope', exact: true })).toBeVisible();
    const ripeness = page.getByText('Ripeness', { exact: true }).locator('..').locator('dd');
    for (let weeks = 0; weeks < 46 && Number.parseInt(await ripeness.innerText(), 10) < 90; weeks++) await advanceWeek(page);
    expect(Number.parseInt(await ripeness.innerText(), 10)).toBeGreaterThanOrEqual(90);
    await page.getByLabel('Harvest target (kg)', { exact: true }).fill('200');
    await page.getByRole('button', { name: 'Start harvest', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Cancel harvest', exact: true })).toBeVisible();
    await advanceWeek(page);
    await page.getByRole('button', { name: 'Winery', exact: true }).click();
    for (let weeks = 0; weeks < 5 && !await page.getByRole('button', { name: 'Press grapes', exact: true }).isVisible(); weeks++) await advanceWeek(page);
    await page.getByLabel('Skin contact', { exact: true }).check();
    await page.getByRole('button', { name: 'Press grapes', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Start / configure fermentation', exact: true })).toBeVisible();
    await page.getByLabel('Fermentation temperature (°C)', { exact: true }).fill('20');
    await page.getByLabel('Lees contact', { exact: true }).check();
    await page.getByRole('button', { name: 'Start / configure fermentation', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Update / restart fermentation', exact: true })).toBeVisible();
    for (let weeks = 0; weeks < 20 && await page.getByRole('button', { name: 'Update / restart fermentation', exact: true }).isVisible(); weeks++) await advanceWeek(page);
    await expect(page.getByRole('button', { name: 'Start / configure fermentation', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cellar', exact: true }).click();
    await page.getByLabel('Number of bottles', { exact: true }).fill('100');
    await page.getByRole('button', { name: 'Bottle wine', exact: true }).click();
    const bottled = page.getByRole('button', { name: /Pinot Noir.*bottled.*100 bottles/i });
    await expect(bottled).toBeVisible();
    await bottled.click();
    await expect(page.getByRole('combobox', { name: 'Buyer', exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/core-cellar-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('combobox', { name: 'Buyer', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/core-cellar-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.getByRole('combobox', { name: 'Buyer', exact: true }).selectOption('local-merchant');
    await page.getByLabel('Number of bottles', { exact: true }).fill('20');
    await page.getByRole('button', { name: 'Sell to Local merchant', exact: true }).click();
    await expect(page.getByRole('button', { name: /Pinot Noir.*bottled.*80 bottles/i })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Calendar')).toBeVisible();
    await page.getByRole('button', { name: 'Cellar', exact: true }).click();
    await expect(page.getByRole('button', { name: /Pinot Noir.*bottled.*80 bottles/i })).toBeVisible();

    await page.getByRole('button', { name: 'Management', exact: true }).click();
    await page.getByLabel('Management sections').getByRole('button', { name: 'Contracts / Market', exact: true }).click();
    const offer = page.getByRole('article').filter({ hasText: 'LOCAL MERCHANT' }).filter({ has: page.getByRole('button', { name: 'Accept contract', exact: true }) }).first();
    await offer.getByRole('button', { name: 'Accept contract', exact: true }).click();
    const commitment = page.getByRole('article').filter({ hasText: 'LOCAL MERCHANT' }).filter({ hasText: 'accepted' }).first();
    const terms = await commitment.getByText(/^\d+ bottles ·/).innerText();
    const requiredBottles = Number.parseInt(terms, 10);
    expect(requiredBottles).toBeGreaterThan(0);
    expect(requiredBottles).toBeLessThanOrEqual(80);
    const wineChoice = commitment.getByRole('combobox', { name: 'Wine to reserve', exact: true });
    const bottledId = await wineChoice.locator('option').filter({ hasText: 'bottled' }).first().getAttribute('value');
    if (!bottledId) throw new Error('The bottled wine is not offered as a contract choice.');
    await wineChoice.selectOption(bottledId);
    await commitment.getByLabel('Bottles to reserve for this lot', { exact: true }).fill(String(requiredBottles));
    await commitment.getByRole('button', { name: 'Reserve bottles', exact: true }).click();
    await expect(commitment.getByRole('button', { name: 'Fulfill contract', exact: true })).toBeEnabled();
    await commitment.getByRole('button', { name: 'Fulfill contract', exact: true }).click();
    await expect(page.getByRole('article').filter({ hasText: 'LOCAL MERCHANT' }).filter({ hasText: 'fulfilled' }).first()).toBeVisible();

    const listResponse = await fetch(`${expectedOrigin}/companies`, { headers: { 'x-winemaker-player-id': profileId } });
    const list = await listResponse.json() as { companies: { id: string; name: string }[] };
    const companyId = list.companies.find(company => company.name === 'Core Loop Browser Winery')!.id;
    const saved = await savedCompany(companyId, profileId);
    expect(saved.state.commercial.sales).toHaveLength(2);
    expect(saved.state.commercial.contracts.filter(contract => contract.status === 'fulfilled')).toHaveLength(1);
    expect(saved.state.inventory.holdings.find(holding => holding.lotId === bottledId)?.quantity).toBe(80 - requiredBottles);
    expect(saved.state.inventory.reservations).toEqual([]);
    expect(saved.state.winery.lots.find(lot => lot.id === bottledId)?.bottling).not.toBeNull();
  });
});
