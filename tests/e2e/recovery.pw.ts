import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { companyStateAt } from '../helpers/CompanyState';

async function mockPlayerProfiles(context: BrowserContext) {
  const profile = { id: '11111111-1111-4111-8111-111111111111', name: 'Test Player', createdAt: new Date().toISOString() };
  await context.route('**/api/players', route => route.request().method() === 'GET'
    ? route.fulfill({ json: { kind: 'players-listed', players: [profile] } })
    : route.fulfill({ status: 201, json: { kind: 'player-created', player: profile } }));
}

function company(week: number, revision: number) {
  return { kind: 'loaded', snapshot: { companyId: 'test-company', revision, state: companyStateAt({ year: 1, season: 1, week }, { weeksPerSeason: 3, seasonsPerYear: 4 }) } };
}

async function openCompany(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Test Player/ }).or(page.getByRole('button', { name: /Test Winery/ })).or(page.getByLabel('Calendar')).first()).toBeVisible();
  if (await page.getByRole('button', { name: /Test Player/ }).isVisible()) {
    await page.getByRole('button', { name: /Test Player/ }).click();
    await expect(page.getByRole('button', { name: /Test Winery/ })).toBeVisible();
  }
  if (await page.getByRole('button', { name: /Test Winery/ }).isVisible()) await page.getByRole('button', { name: /Test Winery/ }).click();
  await expect(page.getByLabel('Calendar')).toContainText('Week 1');
}

test('keeps the company active until an uncertain command is recovered', async ({ page, context }) => {
  await mockPlayerProfiles(context);
  let commands = 0;
  await context.route('**/api/companies**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/companies') return route.fulfill({ json: { kind: 'listed', companies: [{ id: 'test-company', name: 'Test Winery', date: { week: 1, season: 1, year: 1 } }] } });
    if (path.endsWith('/commands')) {
      commands += 1;
      return route.fulfill({ json: commands === 1 ? { kind: 'unknown' } : { kind: 'committed', revision: 1 } });
    }
    if (path.endsWith('/resolve')) return route.fulfill({ json: { kind: 'pending', retry: 'original-command' } });
    return route.fulfill({ json: company(commands > 1 ? 2 : 1, commands > 1 ? 1 : 0) });
  });
  await openCompany(page);
  await page.getByRole('button', { name: 'Advance time' }).click();
  await expect(page.getByRole('button', { name: 'Resolve pending command' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Companies', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Resolve pending command' }).click();
  await expect(page.getByLabel('Calendar')).toContainText('Week 2');
  await expect(page.getByRole('button', { name: 'Companies', exact: true })).toBeEnabled();
});

test('resolves a server command and preserves an unreadable local intent when switching companies', async ({ page, context }) => {
  await mockPlayerProfiles(context);
  const key = 'winemaker05.pending.player-11111111-1111-4111-8111-111111111111.test-company';
  await page.addInitScript(({ storageKey }) => localStorage.setItem(storageKey, '{unreadable'), { storageKey: key });
  let serverPending = true;
  let resolvedId: string | undefined;
  await context.route('**/api/companies**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/companies') return route.fulfill({ json: { kind: 'listed', companies: [
      { id: 'test-company', name: 'Test Winery', date: { week: 1, season: 1, year: 1 } },
      { id: 'other-company', name: 'Other Winery', date: { week: 1, season: 1, year: 1 } },
    ] } });
    if (path.endsWith('/resolve')) {
      resolvedId = route.request().postDataJSON().commandId;
      serverPending = false;
      return route.fulfill({ json: { kind: 'not-committed' } });
    }
    if (path === '/api/companies/other-company') return route.fulfill({ json: { ...company(1, 0), snapshot: { ...company(1, 0).snapshot, companyId: 'other-company' } } });
    return route.fulfill({ json: { ...company(1, 0), ...(serverPending ? { pending: { commandId: 'server-command' } } : {}) } });
  });

  await openCompany(page);
  await expect(page.getByRole('button', { name: 'Advance time' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Companies', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Resolve pending command' }).click();
  await expect(page.getByRole('button', { name: 'Companies', exact: true })).toBeEnabled();
  expect(resolvedId).toBe('server-command');
  await expect(page.getByRole('button', { name: 'Advance time' })).toBeDisabled();
  await page.getByText('Unreadable saved command', { exact: true }).click();
  await expect(page.getByLabel('Saved command record')).toHaveValue('{unreadable');
  await page.getByRole('button', { name: 'Companies', exact: true }).click();
  await page.getByRole('button', { name: /Other Winery/ }).click();
  await expect(page.getByRole('button', { name: 'Advance time' })).toBeEnabled();
  expect(await page.evaluate(storageKey => localStorage.getItem(storageKey), key)).toBe('{unreadable');
});

test('requires a fresh snapshot after a committed command when reload fails', async ({ page, context }) => {
  await mockPlayerProfiles(context);
  let committed = false;
  let failReload = false;
  await context.route('**/api/companies**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/companies') return route.fulfill({ json: { kind: 'listed', companies: [{ id: 'test-company', name: 'Test Winery', date: { week: 1, season: 1, year: 1 } }] } });
    if (path.endsWith('/commands')) {
      committed = true;
      failReload = true;
      return route.fulfill({ json: { kind: 'committed', revision: 1 } });
    }
    if (failReload) { failReload = false; return route.abort(); }
    return route.fulfill({ json: company(committed ? 2 : 1, committed ? 1 : 0) });
  });
  await openCompany(page);
  await page.getByRole('button', { name: 'Advance time' }).click();
  await expect(page.getByRole('button', { name: 'Refresh company' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Advance time' })).toBeDisabled();
  await page.getByRole('button', { name: 'Refresh company' }).click();
  await expect(page.getByLabel('Calendar')).toContainText('Week 2');
  await expect(page.getByRole('button', { name: 'Advance time' })).toBeEnabled();
});

test('shares an in-flight command with another tab without allowing it to advance', async ({ page, context }) => {
  await mockPlayerProfiles(context);
  let revision = 0;
  let release!: () => void;
  let started!: () => void;
  const requestStarted = new Promise<void>(resolve => { started = resolve; });
  const responseAllowed = new Promise<void>(resolve => { release = resolve; });
  await context.route('**/api/companies**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/companies') return route.fulfill({ json: { kind: 'listed', companies: [{ id: 'test-company', name: 'Test Winery', date: { week: 1, season: 1, year: 1 } }] } });
    if (path.endsWith('/commands')) {
      started();
      await responseAllowed;
      return route.fulfill({ json: { kind: 'unknown' } });
    }
    if (path.endsWith('/resolve')) {
      revision = 1;
      return route.fulfill({ json: { kind: 'committed', revision } });
    }
    return route.fulfill({ json: company(revision + 1, revision) });
  });
  await openCompany(page);
  const other = await context.newPage();
  await openCompany(other);
  try {
    await page.getByRole('button', { name: 'Advance time' }).click();
    await requestStarted;
    await expect(other.getByRole('button', { name: 'Resolve pending command' })).toBeVisible();
    await expect(other.getByRole('button', { name: 'Advance time' })).toBeDisabled();
    const lockAvailable = await other.evaluate(() => navigator.locks.request(
      'winemaker05.command.["player-11111111-1111-4111-8111-111111111111","test-company"]', { ifAvailable: true }, lock => Boolean(lock),
    ));
    expect(lockAvailable).toBe(false);
  } finally {
    release();
  }
  await page.getByRole('button', { name: 'Resolve pending command' }).click();
  await expect(page.getByLabel('Calendar')).toContainText('Week 2');
  await expect(other.getByRole('button', { name: 'Refresh company' })).toBeVisible();
  await expect(other.getByRole('button', { name: 'Advance time' })).toBeDisabled();
  await other.getByRole('button', { name: 'Refresh company' }).click();
  await expect(other.getByLabel('Calendar')).toContainText('Week 2');
  await expect(other.getByRole('button', { name: 'Advance time' })).toBeEnabled();
});
