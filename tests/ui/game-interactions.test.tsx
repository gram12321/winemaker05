// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CompanyState } from '../../src/game/core/CompanyState';
import type { CellarLotView } from '../../src/game/queries/CompanyView';
import App from '../../src/App';
import { Cellar } from '../../src/components/game/Cellar';
import { PressForm } from '../../src/components/game/LotActions';
import { money, percent } from '../../src/components/game/common';

vi.mock('../../src/scene/SceneCanvas', () => ({ SceneCanvas: () => null }));
vi.mock('../../src/game/queries/CompanyView', () => ({
  companyView: (state: CompanyState) => ({
    week: state.week, weather: state.estate.weather, finance: state.finance,
    grapeOptions: [{ id: 'pinot-noir', name: 'Pinot Noir' }, { id: 'chardonnay', name: 'Chardonnay' }],
    siteOptions: [{ id: 'hillside', name: 'North Slope', region: 'Upper Valley' }, { id: 'riverbend', name: 'River Bend', region: 'Lower Valley' }],
    vineyards: [], lots: [], archivedLots: [], vessels: [], cellarTemperatureC: 14,
    work: state.work, workPreview: { work: state.work, outputs: [] }, harvestStorageFreeG: 500000,
    customers: state.commercial.customers, contracts: [], reservations: [], sales: [],
    summary: { vineyardCount: 0, liveLotCount: 0, bottlesInCellar: 0, totalRevenueCents: 0, landAssetsCents: 0, activeCommitments: 0 },
  }),
  vineyardEstablishmentPreview: (siteId: string, grapeId: string, areaHa: number) => areaHa >= 0.01 && areaHa <= 100
    ? { ok: true, value: {
      costCents: Math.round((siteId === 'riverbend' ? 1_750_000 : 2_400_000) * areaHa),
      terroirPotential: siteId === 'riverbend' && grapeId === 'chardonnay' ? 0.64 : 0.81,
      originPrestige: siteId === 'riverbend' ? 0.48 : 0.62,
    } }
    : { ok: false, reason: 'Choose a valid area.' },
  vesselPurchaseQuote: () => ({ ok: true, value: { costCents: 100000 } }),
  forecastLot: () => null, saleQuote: () => null,
}));
vi.mock('../../src/game/queries/ActionPreviews', () => ({
  previewCommand: (_state: CompanyState, command: { type: string; name?: string }) => command.type === 'vineyard.establish' && !command.name ? { allowed: false, reasons: ['Name required'] } : { allowed: true, reasons: [] },
  pressDestinations: () => [
    { vessel: { id: 'small', name: 'Small tank' }, preview: { allowed: false, reasons: ['Not enough capacity.'], outcome: null } },
    { vessel: { id: 'large', name: 'Large tank' }, preview: { allowed: true, reasons: [], outcome: { juiceMl: 65000, extractedPhenolics: 0.12, greenCharacterAdded: 0.02, oxygenExposureAdded: 0.04 } } },
  ],
  transferDestinations: () => [], splitDestinations: () => [], blendDestinations: () => [], contractFulfillment: () => ({ allowed: false, reasons: ['Reserve all bottles.'] }),
}));

afterEach(cleanup);

function company(): CompanyState {
  return {
    calendar: { rules: { weeksPerSeason: 12, seasonsPerYear: 4 }, date: { year: 1, season: 1, week: 1 } },
    week: 0, sequence: 1, estate: { vineyards: [], weather: { temperatureC: 16, rainMm: 12, humidity: 0.5 } },
    winery: { lots: [], archivedLots: [] }, inventory: { holdings: [], reservations: [] },
    equipment: { vessels: [], cellarTemperatureC: 14 },
    finance: { cashCents: 12000000, wageArrearsCents: 0, postings: [] },
    work: { staff: [{ id: 'alex', name: 'Alex', kgPerWeek: 600, experience: 0 }], activities: [{ id: 'harvest-1', vineyardId: 'v1', targetKg: 300, completedKg: 100, staffIds: ['alex'], priority: 1, blockedReason: null }] },
    commercial: { customers: [], contracts: [], sales: [] },
  };
}

describe('connected game interactions', () => {
  it('dispatches the named vineyard choices and respects the connection gate', async () => {
    const user = userEvent.setup();
    const state = company();
    const onCommand = vi.fn();
    const { rerender } = render(<App company={state} calendar={state.calendar} onCommand={onCommand} canAdvance />);
    await user.type(screen.getByLabelText('Vineyard name'), 'West Field');
    await user.selectOptions(screen.getByLabelText('Site'), 'riverbend');
    await user.selectOptions(screen.getByLabelText('Grape'), 'chardonnay');
    const area = screen.getByLabelText('Area (hectares)');
    await user.clear(area); await user.type(area, '2');
    expect(screen.getByText('Land cost')).toBeTruthy();
    expect(screen.getByText(money(3_500_000))).toBeTruthy();
    expect(screen.getByText(percent(0.64))).toBeTruthy();
    expect(screen.getByText(percent(0.48))).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Establish vineyard' }));
    expect(onCommand).toHaveBeenCalledWith({ type: 'vineyard.establish', name: 'West Field', siteId: 'riverbend', grapeId: 'chardonnay', areaHa: 2 });
    rerender(<App company={state} calendar={state.calendar} onCommand={onCommand} canAdvance={false} />);
    expect((screen.getByRole('button', { name: 'Establish vineyard' }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Establish vineyard' }));
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it('shows live work and dispatches priority and cancel commands from the hideable manager', async () => {
    const user = userEvent.setup();
    const state = company();
    const onCommand = vi.fn();
    render(<App company={state} calendar={state.calendar} onCommand={onCommand} canAdvance />);
    await user.click(screen.getByRole('button', { name: 'Activity manager' }));
    const manager = screen.getByLabelText('Activity manager', { selector: 'aside' });
    expect(within(manager).getByText(/100 \/ 300 kg/)).toBeTruthy();
    const priority = within(manager).getByLabelText('Priority');
    await user.clear(priority); await user.type(priority, '2');
    await user.click(within(manager).getByRole('button', { name: 'Set priority' }));
    await user.click(within(manager).getByRole('button', { name: 'Cancel harvest' }));
    expect(onCommand).toHaveBeenNthCalledWith(1, { type: 'harvest.priority', activityId: 'harvest-1', priority: 2 });
    expect(onCommand).toHaveBeenNthCalledWith(2, { type: 'harvest.cancel', activityId: 'harvest-1' });
    await user.click(within(manager).getByRole('button', { name: 'Close activity manager' }));
    expect(screen.queryByLabelText('Activity manager', { selector: 'aside' })).toBeNull();
  });

  it('selects a usable press destination from the authority preview', async () => {
    const user = userEvent.setup();
    const state = company();
    const onCommand = vi.fn();
    const row = { lot: { id: 'lot-1' }, holding: { quantity: 100000, unit: 'g' }, pressingCostCents: 100 } as CellarLotView;
    render(<PressForm row={row} company={state} view={{} as never} disabled={false} onCommand={onCommand} />);
    expect((screen.getByRole('option', { name: /Small tank/ }) as HTMLOptionElement).disabled).toBe(true);
    expect((screen.getByLabelText('Press into') as HTMLSelectElement).value).toBe('large');
    expect(screen.getByLabelText('Press outcome preview').textContent).toContain('65 L juice');
    expect(screen.getByLabelText('Press outcome preview').textContent).toMatch(/0[,.]12 phenolics extracted/);
    expect(screen.getByLabelText('Press outcome preview').textContent).toMatch(/\+0[,.]04 oxygen exposure/);
    await user.click(screen.getByRole('button', { name: 'Press grapes' }));
    expect(onCommand).toHaveBeenCalledWith({ type: 'wine.press', lotId: 'lot-1', vesselId: 'large', intensity: 0.5, destem: true, skinContact: false });
  });

  it('shows all blend sources and their shares instead of presenting the dominant origin as the whole blend', () => {
    const state = company();
    const north = {
      vineyardId: 'north-vineyard', vineyardName: 'North Block', region: 'Upper Valley', siteId: 'hillside',
      grapeId: 'pinot-noir', vintage: 2028, terroirPotential: 0.8, originPrestige: 0.6,
    } as const;
    const south = {
      vineyardId: 'south-vineyard', vineyardName: 'South Block', region: 'Lower Valley', siteId: 'riverbend',
      grapeId: 'chardonnay', vintage: 2030, terroirPotential: 0.7, originPrestige: 0.4,
    } as const;
    const row = {
      lot: {
        id: 'blend-1', wineId: 'blend-1', name: 'Valley Blend', form: 'grapes',
        origin: { ...north, vineyardName: 'Dominant Only Block' }, anchors: {},
        physical: { sugarGPerL: 200, alcoholPct: 0, ageDays: 28, developmentAgeDays: 7, maturation: 0, oxygenExposure: 0, lees: 0, oak: 0 },
        processes: { fermenting: false, skinContact: false, temperatureC: 20, leesContact: false },
        parentIds: [], sources: [], history: [], bottling: null,
      },
      originSources: [{ origin: north, fraction: 0.65 }, { origin: south, fraction: 0.35 }],
      holding: { lotId: 'blend-1', quantity: 1000, unit: 'g', location: 'harvest', vesselId: null },
      assessment: { quality: 0.7, structure: { score: 0.7, axes: {} }, taste: { score: 0.6, axes: {} }, descriptors: [], faults: [] },
      status: 'Harvested grapes', available: 1000, reserved: 0, maximumBottles: 0,
      pressingCostCents: 100, maximumBottlingCostCents: null,
      bottlingReadiness: { ready: false, reasons: ['Press the grapes first.'] }, vesselName: 'Harvest receiving',
    } as unknown as CellarLotView;
    const view = { lots: [row], customers: [] };
    const onCommand = vi.fn();

    render(<Cellar company={state} view={view as never} disabled={false} onCommand={onCommand} />);

    expect(screen.getAllByText(/North Block \(pinot noir 2028, 65%\) \+ South Block \(chardonnay 2030, 35%\)/)).toHaveLength(3);
    expect(screen.queryByText(/Dominant Only Block/)).toBeNull();
    expect(screen.getByText(/Quality is based on structure fit, adjusted once for the strongest current physical risk/)).toBeTruthy();
    const sourceDetails = [...document.querySelectorAll('.game-detail-content li')].map(item => item.textContent);
    expect(sourceDetails).toEqual([
      `North Block · Upper Valley · ${percent(0.65)}: Terroir Potential ${percent(0.8)} · Origin Prestige ${percent(0.6)}`,
      `South Block · Lower Valley · ${percent(0.35)}: Terroir Potential ${percent(0.7)} · Origin Prestige ${percent(0.4)}`,
    ]);
    expect(screen.getByText('Wine age').nextElementSibling?.textContent).toBe('7 days');
    expect(screen.getByText('Lot age').nextElementSibling?.textContent).toBe('28 days');
  });
});
