import { expect, test } from '@playwright/test';

test('prototype supports scene selection, navigation and dialogs', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const profile = { id: '11111111-1111-4111-8111-111111111111', name: 'Test Player', createdAt: new Date().toISOString() };
  await page.route('**/api/players', route => route.request().method() === 'GET'
    ? route.fulfill({ json: { kind: 'players-listed', players: [profile] } })
    : route.fulfill({ status: 201, json: { kind: 'player-created', player: profile } }));
  let week = 1; let revision = 0;
  await page.route('**/api/companies**', route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/companies') return route.fulfill({ json: { kind: 'listed', companies: [{ id: 'test-company', name: 'Test Winery', date: { week: 1, season: 1, year: 1 } }] } });
    if (url.pathname.endsWith('/commands')) { week++; revision++; return route.fulfill({ json: { kind: 'committed', revision, events: [] } }); }
    return route.fulfill({ json: { kind: 'loaded', snapshot: { companyId: 'test-company', revision, state: { calendar: { rules: { weeksPerSeason: 3, seasonsPerYear: 4 }, date: { year: 1, season: 1, week } } } } } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Test Winery/ }).click();
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
