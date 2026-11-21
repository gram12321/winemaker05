import { expect, test } from '@playwright/test';

test('named players select their own companies and logout prevents automatic return', async ({ page }) => {
  let next = 0;
  const users = new Map<string, { id: string; aud: string; role: string; is_anonymous: boolean; app_metadata: object; user_metadata: { name: string }; created_at: string }>();
  await page.route('**/auth/v1/signup', async route => {
    const name = route.request().postDataJSON().data.name as string;
    const id = `player-${++next}`;
    const user = { id, aud: 'authenticated', role: 'authenticated', is_anonymous: true, app_metadata: {}, user_metadata: { name }, created_at: '2026-01-01T00:00:00Z' };
    users.set(id, user);
    const token = ['eyJhbGciOiJub25lIn0', Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600, aud: 'authenticated', role: 'authenticated', is_anonymous: true })).toString('base64url'), 'test'].join('.');
    await route.fulfill({ json: { access_token: token, refresh_token: `refresh-${id}`, expires_in: 3600, token_type: 'bearer', user } });
  });
  await page.route('**/auth/v1/user', route => route.fulfill({ json: users.get('player-1') }));
  const companies: Record<string, { id: string; name: string; date: { year: number; season: number; week: number } }[]> = {};
  await page.route('**/api/companies**', async route => {
    const request = route.request();
    const payload = JSON.parse(Buffer.from(request.headers().authorization.split('.')[1], 'base64url').toString()) as { sub: string };
    const list = companies[payload.sub] ??= [];
    const path = new URL(request.url()).pathname;
    if (path === '/api/companies' && request.method() === 'POST') {
      const body = request.postDataJSON() as { companyId: string; name: string };
      list.push({ id: body.companyId, name: body.name, date: { year: 1, season: 1, week: 1 } });
      return route.fulfill({ json: { kind: 'created' } });
    }
    if (path === '/api/companies') return route.fulfill({ json: { kind: 'listed', companies: list } });
    const found = list.find(c => path.endsWith(c.id));
    if (!found) return route.fulfill({ status: 404, json: { kind: 'missing' } });
    return route.fulfill({ json: { kind: 'loaded', snapshot: { companyId: found.id, revision: 0, state: { calendar: { rules: { weeksPerSeason: 12, seasonsPerYear: 4 }, date: found.date } } } } });
  });
  await page.goto('/');
  await page.getByLabel('User Name').fill('Ada');
  await page.getByRole('button', { name: 'Create User' }).click();
  await page.getByLabel('Company Name').fill('Sunny Estate');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByLabel('Calendar')).toBeVisible();
  await page.getByRole('button', { name: 'Companies', exact: true }).click();
  await expect(page.getByRole('button', { name: /Sunny Estate/ })).toContainText('Last played');
  await page.getByRole('button', { name: 'Create New Company' }).click();
  await page.getByLabel('Company Name').fill('Hill Winery');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('Calendar')).toBeVisible();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('heading', { name: /User Selection/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: /Ada/ })).toBeVisible();
  await page.getByRole('button', { name: 'Create New User' }).click();
  await page.getByLabel('User Name').fill('Bea');
  await page.getByRole('button', { name: 'Create User' }).click();
  await expect(page.getByText('No companies yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.getByRole('button', { name: /Ada/ }).click();
  await expect(page.getByRole('button', { name: /Sunny Estate/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Hill Winery/ })).toBeVisible();
  await expect(page.getByLabel('Calendar')).not.toBeVisible();
  await page.getByRole('button', { name: 'README' }).click();
  await expect(page.getByRole('dialog', { name: 'README' })).toContainText('Winemaker05');
});
