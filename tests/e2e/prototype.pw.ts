import { expect, test } from '@playwright/test';

test('desktop prototype supports canvas, keyboard, panels and modal navigation', async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Estate', level: 1 })).toBeVisible();
  const canvas = page.locator('.scene-frame canvas');
  await expect(canvas).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('estate-desktop.png') });

  // Convert a point inside the west parcel from scene coordinates to canvas
  // coordinates using the same fixed composition and fit as the renderer.
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('The scene canvas has no visible bounds.');
  const scale = Math.min(bounds.width / 900, bounds.height / 480);
  await canvas.click({ position: {
    x: (bounds.width - 900 * scale) / 2 + 200 * scale,
    y: (bounds.height - 480 * scale) / 2 + 320 * scale,
  } });
  const west = page.getByRole('button', { name: 'West parcel, Vineyard parcel' });
  await expect(west).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Feature details').getByRole('heading', { name: 'West parcel' })).toBeVisible();
  await page.getByRole('button', { name: 'Close feature details' }).click();
  await expect(west).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(west).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Activity', exact: true }).click();
  const details = await page.getByRole('complementary', { name: 'Feature details', exact: true }).boundingBox();
  const activity = await page.getByRole('complementary', { name: 'Activity Manager', exact: true }).boundingBox();
  if (!details || !activity) throw new Error('A desktop panel is not visible.');
  expect(details.x + details.width).toBeLessThanOrEqual(activity.x + 1);
  await page.screenshot({ path: testInfo.outputPath('activity-desktop.png') });
  await page.getByRole('button', { name: 'Close Activity Manager' }).click();
  await expect(page.getByRole('button', { name: 'Activity', exact: true })).toBeFocused();

  await page.getByRole('button', { name: 'Winery', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Winery', level: 1 })).toBeVisible();
  await expect(page.locator('.scene-frame canvas')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('winery-desktop.png') });
  await page.getByRole('button', { name: 'Cellar', exact: true }).click();
  await expect(page.locator('.scene-frame canvas')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('cellar-desktop.png') });
  await page.getByRole('button', { name: 'Wine detail, Wine' }).click();
  const openWine = page.getByRole('button', { name: 'Open wine detail' });
  await openWine.click();
  await expect(page.getByRole('dialog', { name: 'The story of a wine' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('wine-dialog-desktop.png') });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(openWine).toBeFocused();

  await page.getByRole('button', { name: 'Company', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Company', level: 1 })).toBeVisible();
  await expect(page.locator('.company-illustration canvas')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('company-desktop.png') });
  await page.getByRole('button', { name: 'Management', exact: true }).click();
  for (const section of ['Finance', 'Contracts / Market', 'Equipment', 'People / Work']) {
    await page.getByLabel('Management sections').getByRole('button', { name: section }).click();
    await expect(page.getByRole('heading', { name: section, level: 2 })).toBeVisible();
  }
  await page.screenshot({ path: testInfo.outputPath('management-desktop.png') });
  await expect(page.getByRole('button', { name: /Advance time unavailable/ })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Estate', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Activity', exact: true })).toHaveAttribute('aria-expanded', 'false');
  expect(pageErrors).toEqual([]);
});
