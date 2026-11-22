import { expect, test } from '@playwright/test';

import { companyStateAt } from '../helpers/CompanyState';
import { decideCommand } from '../../src/game/core/decideCommand';

test('connected shell supports live navigation, scenes and calendar commands', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const profile = { id: '11111111-1111-4111-8111-111111111111', name: 'Test Player', createdAt: new Date().toISOString() };
  await page.route('**/api/players', route => route.request().method() === 'GET'
    ? route.fulfill({ json: { kind: 'players-listed', players: [profile] } })
    : route.fulfill({ status: 201, json: { kind: 'player-created', player: profile } }));
  let state = companyStateAt({ year: 1, season: 1, week: 1 }, { weeksPerSeason: 3, seasonsPerYear: 4 });
  let revision = 0;
  await page.route('**/api/companies**', route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/companies') return route.fulfill({ json: { kind: 'listed', companies: [{ id: 'test-company', name: 'Test Winery', date: { week: 1, season: 1, year: 1 } }] } });
    if (url.pathname.endsWith('/commands')) {
      const decision = decideCommand(state, route.request().postDataJSON().command);
      if (decision.kind === 'rejected') return route.fulfill({ status: 422, json: decision });
      state = decision.next; revision++;
      return route.fulfill({ json: { kind: 'committed', revision, events: decision.events } });
    }
    return route.fulfill({ json: { kind: 'loaded', snapshot: { companyId: 'test-company', revision, state } } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Test Winery/ }).click();
  await expect(page.getByLabel('Calendar')).toContainText('Week 1');
  await page.getByRole('button', { name: 'Advance time' }).click();
  await expect(page.getByLabel('Calendar')).toContainText('Week 2');
  await expect(page.getByRole('heading', { name: 'The estate', level: 1 })).toBeVisible();
  const canvas = page.locator('.scene-canvas canvas');
  await expect(canvas).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Establish a vineyard' })).toBeVisible();
  await page.getByRole('button', { name: 'Activity manager' }).click();
  await expect(page.getByRole('complementary', { name: 'Activity manager' })).toBeVisible();
  await page.getByRole('button', { name: 'Close activity manager' }).click();
  await page.getByRole('button', { name: 'Winery', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'The winery', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Cellar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Live lots' })).toBeVisible();
  await expect(page.getByText('Harvest grapes to bring your first lot into the winery.')).toBeVisible();
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
