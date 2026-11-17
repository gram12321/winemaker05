import { expect, test, type BrowserContext, type Page } from '@playwright/test';

async function mockAuthentication(context: BrowserContext) {
  const token = ['eyJhbGciOiJub25lIn0', Buffer.from(JSON.stringify({ sub: 'test-user', exp: Math.floor(Date.now() / 1000) + 3600, aud: 'authenticated', role: 'authenticated' })).toString('base64url'), 'test'].join('.');
  const user = { id: 'test-user', aud: 'authenticated', role: 'authenticated', email: 'test@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  await context.route('**/auth/v1/token?*', route => route.fulfill({ json: { access_token: token, refresh_token: 'refresh', expires_in: 3600, token_type: 'bearer', user } }));
  await context.route('**/auth/v1/user', route => route.fulfill({ json: user }));
}

function company(week: number, revision: number) {
  return { kind: 'loaded', snapshot: { companyId: 'test-company', revision, state: { calendar: { rules: { weeksPerSeason: 3, seasonsPerYear: 4 }, date: { year: 1, season: 1, week } } } } };
}

async function openCompany(page: Page) {
  await page.goto('/');
  if (await page.getByLabel('Email').isVisible()) {
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('example-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
  }
  await page.getByRole('button', { name: /Open company/ }).click();
  await expect(page.getByLabel('Calendar')).toContainText('Week 1');
}

test('keeps the company active until an uncertain command is recovered', async ({ page, context }) => {
  await mockAuthentication(context);
  let commands = 0;
  await context.route('**/api/companies**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/companies') return route.fulfill({ json: { kind: 'listed', companyIds: ['test-company'] } });
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

test('requires a fresh snapshot after a committed command when reload fails', async ({ page, context }) => {
  await mockAuthentication(context);
  let committed = false;
  let failReload = false;
  await context.route('**/api/companies**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/companies') return route.fulfill({ json: { kind: 'listed', companyIds: ['test-company'] } });
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
  await mockAuthentication(context);
  let revision = 0;
  let release!: () => void;
  let started!: () => void;
  const requestStarted = new Promise<void>(resolve => { started = resolve; });
  const responseAllowed = new Promise<void>(resolve => { release = resolve; });
  await context.route('**/api/companies**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/companies') return route.fulfill({ json: { kind: 'listed', companyIds: ['test-company'] } });
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
      'winemaker05.command.["test-user","test-company"]', { ifAvailable: true }, lock => Boolean(lock),
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
