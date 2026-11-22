import { describe, expect, it } from 'vitest';
import { readCompanyState } from '../../src/game/core/CompanyState';
import { createVineyard } from '../../src/game/vineyard/Rules';
import { createWineOrigin } from '../../src/game/vineyard/Origin';
import { createHarvestLot } from '../../src/game/wine/Anchors';
import { developLot } from '../../src/game/wine/Development';
import { blendLots, bottleLot, configureFermentation, pressLot, splitLot } from '../../src/game/wine/Operations';
import { companyStateAt } from '../helpers/CompanyState';

function materialState() {
  const created = createVineyard({ id: 'vineyard-1', name: 'Test slope', siteId: 'hillside', grapeId: 'pinot-noir', areaHa: 1, year: 1 });
  if (!created.ok) throw new Error(created.reason);
  const vineyard = { ...created.value.vineyard, ripeness: 0.9, cropKg: 1000, harvestedKg: 200, ripeKg: 700 };
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

  it('rejects missing, impossible, premature and sub-gram vineyard crop quantities', () => {
    const state = materialState();
    const vineyard = state.estate.vineyards[0];
    const { lostKg: _lostKg, ...oldShape } = vineyard;
    for (const bad of [
      oldShape,
      { ...vineyard, lostKg: 100.001 },
      { ...vineyard, ripeKg: -0.001 },
      { ...vineyard, ripeKg: 700.0001 },
      { ...vineyard, ripeness: 0.49 },
    ]) {
      expect(readCompanyState({ ...state, estate: { ...state.estate, vineyards: [bad] } }).kind).toBe('invalid');
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
      { ...source, physical: { ...source.physical, aroma: source.anchors.aromatics + 0.01 } },
    ]) expect(readCompanyState({ ...state, winery: { lots: [], archivedLots: [bad] }, inventory: { holdings: [], reservations: [] } }).kind).toBe('invalid');
  });

  it('requires split and bottled descendants to retain their parent provenance', () => {
    const state = materialState();
    const pressed = pressLot(state.winery.lots[0], 0.5, true, false, 0);
    if (!pressed.ok) throw new Error(pressed.reason);
    const configured = configureFermentation(pressed.value.lot, { temperatureC: 20, skinContact: false, leesContact: false }, 0);
    if (!configured.ok) throw new Error(configured.reason);
    const parent = developLot(configured.value, { temperatureC: 20, oxygenIngress: 0, oakStrength: 0, contaminationRisk: 0 }, 60).lot;
    const split = splitLot(parent, 'lot-3', 0);
    const bottledResult = bottleLot(parent, 'lot-4', 0, { week: 0, structure: 0.7, taste: 0.7, quality: 0.7 });
    if (!bottledResult.ok) throw new Error(bottledResult.reason);
    const bottled = bottledResult.value;
    const snapshot = { ...state, winery: { lots: [], archivedLots: [parent, split, bottled] }, inventory: { holdings: [], reservations: [] } };
    expect(readCompanyState(snapshot).kind).toBe('valid');

    for (const child of [split, bottled]) {
      const changedAnchors = { ...child.anchors, body: child.anchors.body + 0.01 };
      const changedOrigin = { ...child.origin, vineyardName: 'Different source' };
      for (const bad of [
        { ...child, anchors: changedAnchors, sources: [{ ...child.sources[0], anchors: changedAnchors }] },
        { ...child, origin: changedOrigin, sources: [{ ...child.sources[0], origin: changedOrigin }] },
        { ...child, wineId: 'different-wine' },
      ]) {
        const corrupted = { ...snapshot, winery: { ...snapshot.winery, archivedLots: snapshot.winery.archivedLots.map(lot => lot.id === child.id ? bad : lot) } };
        expect(readCompanyState(corrupted).kind).toBe('invalid');
      }
    }
  });

  it('retains source identities across blends without inventing missing blend quantities', () => {
    const state = materialState();
    const first = state.winery.lots[0];
    const otherVineyard = { ...state.estate.vineyards[0], id: 'another-vineyard', name: 'Other slope', grapeId: 'chardonnay' as const };
    const second = createHarvestLot({ id: 'lot-3', wineId: 'other-wine', name: 'Chardonnay', origin: createWineOrigin(otherVineyard), vineyard: otherVineyard, week: 0 });
    const firstMust = pressLot(first, 0.5, true, false, 0);
    const secondMust = pressLot(second, 0.5, true, false, 0);
    if (!firstMust.ok || !secondMust.ok) throw new Error('Expected both lots to press.');
    const blended = blendLots([{ lot: firstMust.value.lot, quantity: 1 }, { lot: secondMust.value.lot, quantity: 3 }], 'lot-4', 'Blend', 0);
    if (!blended.ok) throw new Error(blended.reason);
    const split = splitLot(blended.value, 'lot-5', 0);
    const snapshot = { ...state, winery: { lots: [], archivedLots: [firstMust.value.lot, secondMust.value.lot, blended.value, split] }, inventory: { holdings: [], reservations: [] } };
    expect(readCompanyState(snapshot).kind).toBe('valid');

    const differentlyWeighted = blendLots([{ lot: firstMust.value.lot, quantity: 1 }, { lot: secondMust.value.lot, quantity: 9 }], 'lot-4', 'Blend', 0);
    if (!differentlyWeighted.ok) throw new Error(differentlyWeighted.reason);
    const anotherValidSnapshot = { ...snapshot, winery: { ...snapshot.winery, archivedLots: [firstMust.value.lot, secondMust.value.lot, differentlyWeighted.value, splitLot(differentlyWeighted.value, 'lot-5', 0)] } };
    expect(readCompanyState(anotherValidSnapshot).kind).toBe('valid');
    const wrongShares = { ...split, anchors: differentlyWeighted.value.anchors, origin: differentlyWeighted.value.origin, sources: differentlyWeighted.value.sources };
    expect(readCompanyState({ ...snapshot, winery: { ...snapshot.winery, archivedLots: [firstMust.value.lot, secondMust.value.lot, blended.value, wrongShares] } }).kind).toBe('invalid');

    const replacedSource = { ...blended.value.sources[0], origin: { ...blended.value.sources[0].origin, vineyardName: 'Invented source' } };
    const badBlend = { ...blended.value, sources: [replacedSource, ...blended.value.sources.slice(1)] };
    const badSplit = splitLot(badBlend, 'lot-5', 0);
    const corrupted = { ...snapshot, winery: { ...snapshot.winery, archivedLots: [firstMust.value.lot, secondMust.value.lot, badBlend, badSplit] } };
    expect(readCompanyState(corrupted).kind).toBe('invalid');
  });
});
