import { expect, test } from '@playwright/test';

import { companyStateAt } from '../helpers/CompanyState';
import { decideCommand } from '../../src/game/core/decideCommand';
import { SCENE_HEIGHT, SCENE_WIDTH } from '../../src/scene/drawScenes';

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
  await expect(page.getByRole('heading', { name: 'Unbottled lots' })).toBeVisible();
  await expect(page.getByText('There are no unbottled lots in storage. Establish a vineyard or select a bottled wine below.')).toBeVisible();
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

test('routes real canvas hotspots and keyboard destinations, then redraws refreshed vineyard state', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const profile = { id: '11111111-1111-4111-8111-111111111111', name: 'Test Player', createdAt: new Date().toISOString() };
  await page.route('**/api/players', route => route.request().method() === 'GET'
    ? route.fulfill({ json: { kind: 'players-listed', players: [profile] } })
    : route.fulfill({ status: 201, json: { kind: 'player-created', player: profile } }));
  let state = companyStateAt({ year: 7, season: 2, week: 5 }, { weeksPerSeason: 8, seasonsPerYear: 3 });
  let revision = 0;
  await page.route('**/api/companies**', route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/companies') return route.fulfill({ json: { kind: 'listed', companies: [{ id: 'scene-company', name: 'Scene Winery', date: state.calendar.date }] } });
    if (url.pathname.endsWith('/commands')) {
      const decision = decideCommand(state, route.request().postDataJSON().command);
      if (decision.kind === 'rejected') return route.fulfill({ status: 422, json: decision });
      state = decision.next;
      revision += 1;
      return route.fulfill({ json: { kind: 'committed', revision, events: decision.events } });
    }
    return route.fulfill({ json: { kind: 'loaded', snapshot: { companyId: 'scene-company', revision, state } } });
  });

  await page.goto('/');
  await page.getByRole('button', { name: /Scene Winery/ }).click();
  await expect(page.getByText('Year 7 · Season 2 · Week 5 of 8 (3 seasons/year)')).toBeVisible();
  const canvas = page.locator('.scene-canvas canvas');
  await expect(canvas).toBeVisible();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Estate canvas has no visible bounds.');

  const buildingMarker = { x: 637, y: 225 };
  await page.mouse.click(
    bounds.x + (buildingMarker.x / SCENE_WIDTH) * bounds.width,
    bounds.y + (buildingMarker.y / SCENE_HEIGHT) * bounds.height,
  );
  await expect(page.getByRole('heading', { name: 'Production room' })).toBeVisible();
  await expect(page.locator('[data-game-focus="winery-lots"]')).toBeFocused();

  const harvestShortcut = page.getByRole('button', { name: 'Open Harvest work' });
  await harvestShortcut.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'The estate', level: 1 })).toBeVisible();
  await expect(page.locator('[data-game-focus="estate-work"]')).toBeFocused();

  const establishmentShortcut = page.getByRole('button', { name: 'Open Establish a vineyard' });
  await establishmentShortcut.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-game-focus="estate-establish"]')).toBeFocused();
  const beforePlanting = await canvas.screenshot();
  await page.getByLabel('Vineyard name').fill('North Slope');
  await page.getByRole('button', { name: 'Establish vineyard' }).click();
  await expect(page.locator('.game-scene-status')).toContainText('1 vineyard · 0 with harvestable crop');
  await expect.poll(async () => !Buffer.from(beforePlanting).equals(Buffer.from(await canvas.screenshot()))).toBe(true);

  await page.screenshot({ path: 'test-results/scene-connected-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 320, height: 640 });
  await expect(page.getByRole('button', { name: 'Open Establish a vineyard' })).toBeVisible();
  await expect(page.locator('.game-scene-shortcuts button')).toHaveCount(3);
  const shortcutBoxes = await page.locator('.game-scene-shortcuts button').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().toJSON()));
  await page.screenshot({ path: 'test-results/scene-connected-narrow.png', fullPage: true });
  expect(shortcutBoxes.every(box => box.width > 100 && box.x >= 0 && box.right <= 320), JSON.stringify(shortcutBoxes)).toBe(true);
  expect(errors).toEqual([]);
});
