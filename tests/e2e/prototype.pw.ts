import { expect, test } from '@playwright/test';

test('prototype supports scene selection, navigation and dialogs', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const token = ['eyJhbGciOiJub25lIn0', Buffer.from(JSON.stringify({ sub: 'test-user', exp: Math.floor(Date.now() / 1000) + 3600, aud: 'authenticated', role: 'authenticated' })).toString('base64url'), 'test'].join('.');
  const user = { id: 'test-user', aud: 'authenticated', role: 'authenticated', email: 'test@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  await page.route('**/auth/v1/token?*', route => route.fulfill({ json: { access_token: token, refresh_token: 'refresh', expires_in: 3600, token_type: 'bearer', user } }));
  await page.route('**/auth/v1/user', route => route.fulfill({ json: user }));
  let week = 1; let revision = 0;
  await page.route('**/api/companies**', route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/companies') return route.fulfill({ json: { kind: 'listed', companyIds: ['test-company'] } });
    if (url.pathname.endsWith('/commands')) { week++; revision++; return route.fulfill({ json: { kind: 'committed', revision, events: [] } }); }
    return route.fulfill({ json: { kind: 'loaded', snapshot: { companyId: 'test-company', schemaVersion: 1, revision, state: { calendar: { rules: { weeksPerSeason: 3, seasonsPerYear: 4 }, date: { year: 1, season: 1, week } } } } } });
  });
  await page.goto('/');
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password').fill('example-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: /Open company/ }).click();
  await expect(page.getByLabel('Calendar')).toContainText('Week 1');
  await page.getByRole('button', { name: 'Advance time' }).click();
  await expect(page.getByLabel('Calendar')).toContainText('Week 2');
  await expect(page.getByRole('heading', { name: 'The estate', level: 1 })).toBeVisible();
  const canvas = page.locator('.scene-canvas canvas');
  await expect(canvas).toBeVisible();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Scene canvas is not visible');
  await canvas.click({ position: { x: bounds.width * 255 / 1000, y: bounds.height * 325 / 530 } });
  const parcel = page.getByRole('button', { name: /Vineyard parcel/ });
  await expect(parcel).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Close place details' }).click();
  await expect(parcel).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(parcel).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Activity manager' }).click();
  await expect(page.getByRole('complementary', { name: 'Activity manager' })).toBeVisible();
  await page.getByRole('button', { name: 'Close activity manager' }).click();
  await page.getByRole('button', { name: 'Winery', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'The winery', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Cellar', exact: true }).click();
  await page.getByRole('button', { name: /Wine details\s*View details/ }).click();
  const open = page.getByRole('button', { name: 'Open wine details' });
  await open.click();
  await expect(page.getByRole('dialog', { name: 'Wine details' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(open).toBeFocused();
  await page.getByRole('button', { name: 'Company', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your company', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Management', exact: true }).click();
  for (const name of ['Finance', 'Contracts / Market', 'Equipment', 'People / Work']) {
    await page.getByLabel('Management sections').getByRole('button', { name }).click();
    await expect(page.getByRole('heading', { name, level: 2 })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Advance time' })).toBeEnabled();
  expect(errors).toEqual([]);
});
