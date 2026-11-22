import { expect, test } from '@playwright/test';
import { companyStateAt } from '../helpers/CompanyState';

test('database-backed player profiles can return to their companies after local selection is cleared', async ({ page }) => {
  const players: { id: string; name: string; createdAt: string }[] = [];
  const companies = new Map<string, { id: string; name: string; date: { year: number; season: number; week: number } }[]>();
  await page.route('**/api/players**', async route => {
    const request = route.request();
    if (request.method() === 'GET') return route.fulfill({ json: { kind: 'players-listed', players } });
    const path = new URL(request.url()).pathname;
    const body = request.postDataJSON() as { id: string; name: string };
    if (request.method() === 'PATCH') {
      const player = players.find(value => path.endsWith(value.id));
      if (player) player.name = body.name;
      return route.fulfill({ json: { kind: 'player-updated', player } });
    }
    const player = { id: body.id, name: body.name, createdAt: new Date().toISOString() };
    players.push(player);
    return route.fulfill({ status: 201, json: { kind: 'player-created', player } });
  });
  await page.route('**/api/companies**', async route => {
    const request = route.request();
    const playerId = request.headers()['x-winemaker-player-id'] ?? 'guest';
    const list = companies.get(playerId) ?? [];
    companies.set(playerId, list);
    const path = new URL(request.url()).pathname;
    if (path === '/api/companies' && request.method() === 'POST') {
      const body = request.postDataJSON() as { companyId: string; name: string };
      list.push({ id: body.companyId, name: body.name, date: { year: 1, season: 1, week: 1 } });
      return route.fulfill({ json: { kind: 'created' } });
    }
    if (path === '/api/companies') return route.fulfill({ json: { kind: 'listed', companies: list } });
    const company = list.find(value => path.endsWith(value.id));
    if (!company) return route.fulfill({ status: 404, json: { kind: 'missing' } });
    const snapshot = { companyId: company.id, revision: 0, state: companyStateAt(company.date) };
    return route.fulfill({ json: { kind: 'loaded', snapshot } });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Create New User' }).click();
  await page.getByLabel('User Name').fill('Ada');
  await page.getByRole('button', { name: 'Create User' }).click();
  await expect(page.getByRole('heading', { name: /My Companies/ })).toBeVisible();
  await page.getByLabel('Company Name').fill('Sunny Estate');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByLabel('Calendar')).toBeVisible();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('button', { name: /Ada/ })).toBeVisible();

  await page.evaluate(() => localStorage.removeItem('winemaker05.selectedPlayer'));
  await page.reload();
  await expect(page.getByRole('button', { name: /Sunny Estate/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Sunny Estate/ })).toContainText('Week 1');
  await expect(page.getByLabel('Calendar')).not.toBeVisible();
});

test('starts a company directly without creating a player and can reopen it', async ({ page }) => {
  let profileCreations = 0;
  let savedCompany: { id: string; name: string } | undefined;
  await page.route('**/api/players**', route => {
    if (route.request().method() === 'POST') profileCreations += 1;
    return route.fulfill({ json: { kind: 'players-listed', players: [] } });
  });
  await page.route('**/api/companies**', route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    expect(request.headers()['x-winemaker-unassigned']).toBe('1');
    if (path === '/api/companies' && request.method() === 'POST') {
      const body = request.postDataJSON() as { companyId: string; name: string };
      savedCompany = { id: body.companyId, name: body.name };
      return route.fulfill({ json: { kind: 'created' } });
    }
    const date = { year: 1, season: 1, week: 1 };
    if (path === '/api/companies') return route.fulfill({ json: { kind: 'listed', companies: savedCompany ? [{ ...savedCompany, date }] : [] } });
    if (!savedCompany || !path.endsWith(savedCompany.id)) return route.fulfill({ status: 404, json: { kind: 'missing' } });
    return route.fulfill({ json: { kind: 'loaded', snapshot: { companyId: savedCompany.id, revision: 0, state: companyStateAt(date) } } });
  });

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Create New User' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Create Company Without User' }).click();
  await page.getByLabel('Company Name').fill('Unassigned Estate');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByLabel('Calendar')).toBeVisible();
  expect(profileCreations).toBe(0);
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('button', { name: /Unassigned Estate/ })).toBeVisible();
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('button', { name: /Unassigned Estate/ })).toBeVisible();
  await page.getByRole('button', { name: /Unassigned Estate/ }).click();
  await expect(page.getByLabel('Calendar')).toBeVisible();
});

test('retries the same unassigned company after a lost creation response', async ({ page }) => {
  const attempts: { companyId: string; name: string }[] = [];
  await page.route('**/api/players', route => route.fulfill({ json: { kind: 'players-listed', players: [] } }));
  await page.route('**/api/companies**', route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const date = { year: 1, season: 1, week: 1 };
    if (path === '/api/companies' && request.method() === 'POST') {
      attempts.push(request.postDataJSON() as { companyId: string; name: string });
      return attempts.length === 1 ? route.abort() : route.fulfill({ json: { kind: 'not-created' } });
    }
    if (path === '/api/companies') return route.fulfill({ json: { kind: 'listed', companies: attempts.length ? [{ id: attempts[0].companyId, name: attempts[0].name, date }] : [] } });
    return route.fulfill({ json: { kind: 'loaded', snapshot: { companyId: attempts[0].companyId, revision: 0, state: companyStateAt(date) } } });
  });

  await page.goto('/');
  await page.getByLabel('Company Name').fill('Retry Estate');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry creating company' })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Company Name')).toHaveValue('Retry Estate');
  await page.getByRole('button', { name: 'Retry creating company' }).click();
  await expect(page.getByLabel('Calendar')).toBeVisible();
  expect(attempts).toHaveLength(2);
  expect(attempts[1]).toEqual(attempts[0]);
});

test('retries the same player after a lost response and reload', async ({ page }) => {
  const attempts: { id: string; name: string }[] = [];
  const players: { id: string; name: string; createdAt: string }[] = [];
  await page.route('**/api/players', route => {
    const request = route.request();
    if (request.method() === 'GET') return route.fulfill({ json: { kind: 'players-listed', players } });
    const intent = request.postDataJSON() as { id: string; name: string };
    attempts.push(intent);
    if (attempts.length === 1) {
      players.push({ ...intent, createdAt: '2026-01-01T00:00:00.000Z' });
      return route.abort();
    }
    return route.fulfill({ status: 201, json: { kind: 'player-created', player: players[0] } });
  });
  await page.route('**/api/companies', route => route.fulfill({ json: { kind: 'listed', companies: [] } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Create New User' }).click();
  await page.getByLabel('User Name').fill('Ada');
  await page.getByRole('button', { name: 'Create User' }).click();
  await expect(page.getByRole('button', { name: 'Retry creating user' })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('User Name')).toHaveValue('Ada');
  await page.getByRole('button', { name: 'Retry creating user' }).click();
  await expect(page.getByRole('heading', { name: /My Companies/ })).toBeVisible();
  expect(attempts).toHaveLength(2);
  expect(attempts[1]).toEqual(attempts[0]);
  expect(players).toHaveLength(1);
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('button', { name: /Ada/ })).toHaveCount(1);
});

test('lets the player discard an invalid saved company request', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('winemaker05.creation.unassigned', '{invalid'));
  await page.route('**/api/players', route => route.fulfill({ json: { kind: 'players-listed', players: [] } }));
  await page.route('**/api/companies', route => route.fulfill({ json: { kind: 'listed', companies: [] } }));
  await page.goto('/');
  await expect(page.getByText('The saved company request is invalid.')).toBeVisible();
  await page.getByRole('button', { name: 'Discard invalid request' }).click();
  await expect(page.getByLabel('Company Name')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('winemaker05.creation.unassigned'))).toBeNull();
});
