import { describe, expect, it } from 'vitest';
import { readCompanyState } from '../../src/game/core/CompanyState';
import { createVineyard } from '../../src/game/vineyard/Rules';
import { createWineOrigin } from '../../src/game/vineyard/Origin';
import { createHarvestLot } from '../../src/game/wine/Anchors';
import { pressLot } from '../../src/game/wine/Operations';
import { companyStateAt } from '../helpers/CompanyState';

function materialState() {
  const created = createVineyard({ id: 'vineyard-1', name: 'Test slope', siteId: 'hillside', grapeId: 'pinot-noir', areaHa: 1, year: 1 });
  if (!created.ok) throw new Error(created.reason);
  const vineyard = { ...created.value.vineyard, ripeness: 0.9, cropKg: 1000, harvestedKg: 200 };
  const lot = createHarvestLot({ id: 'lot-2', wineId: 'vineyard-1-1', name: 'Pinot Noir', origin: createWineOrigin(vineyard), vineyard, week: 0 });
  return { ...companyStateAt(), sequence: 10, estate: { vineyards: [vineyard], weather: { temperatureC: 20, rainMm: 10, humidity: 0.5 } }, winery: { lots: [lot], archivedLots: [] }, inventory: { holdings: [{ lotId: lot.id, quantity: 200_000, unit: 'g' as const, location: 'harvest' as const, vesselId: null }], reservations: [] } };
}

describe('current company snapshot boundary', () => {
  it('requires the current schema and freezes an independent valid snapshot', () => {
    const input = materialState();
    const result = readCompanyState(input);
    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') throw new Error(result.reasons.join(' '));
    input.inventory.holdings[0].quantity = 1;
    expect(result.state.inventory.holdings[0].quantity).toBe(200_000);
    expect(Object.isFrozen(result.state.winery.lots[0].sources[0].anchors)).toBe(true);
    expect(readCompanyState({ calendar: input.calendar }).kind).toBe('invalid');
  });

  it('rejects quantity, units, cash/posting and deterministic ID corruption without changing it', () => {
    const original = materialState();
    const invalid = [
      { ...original, inventory: { ...original.inventory, holdings: [{ ...original.inventory.holdings[0], quantity: -1 }] } },
      { ...original, inventory: { ...original.inventory, holdings: [{ ...original.inventory.holdings[0], unit: 'ml' }] } },
      { ...original, finance: { ...original.finance, cashCents: 1 } },
      { ...original, sequence: 2 },
    ];
    for (const snapshot of invalid) {
      const before = structuredClone(snapshot);
      expect(readCompanyState(snapshot).kind).toBe('invalid');
      expect(snapshot).toEqual(before);
    }
  });

  it('rejects liquid capacity overflow and missing allocation targets', () => {
    const state = materialState();
    const pressed = pressLot(state.winery.lots[0], 0.5, true, true, 0);
    if (!pressed.ok) throw new Error(pressed.reason);
    const withLiquid = { ...state, winery: { lots: [pressed.value.lot], archivedLots: [] }, inventory: { holdings: [{ lotId: pressed.value.lot.id, quantity: 3_000_000, unit: 'ml', location: 'vessel', vesselId: 'starter-tank' }], reservations: [] } };
    expect(readCompanyState(withLiquid).kind).toBe('invalid');
    expect(readCompanyState({ ...withLiquid, inventory: { ...withLiquid.inventory, holdings: [{ ...withLiquid.inventory.holdings[0], quantity: 1000, vesselId: 'absent-vessel' }] } }).kind).toBe('invalid');
  });

  it('checks archived provenance, inherited capacities and source proportions', () => {
    const state = materialState();
    const source = state.winery.lots[0];
    for (const bad of [
      { ...source, parentIds: ['absent-parent'] },
      { ...source, anchors: { ...source.anchors, body: 1 } },
      { ...source, sources: [{ ...source.sources[0], fraction: 0.5 }] },
      { ...source, physical: { ...source.physical, remainingPhenolics: 1, phenolics: 1 } },
    ]) expect(readCompanyState({ ...state, winery: { lots: [], archivedLots: [bad] }, inventory: { holdings: [], reservations: [] } }).kind).toBe('invalid');
  });
});
