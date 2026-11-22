import { describe, expect, it } from 'vitest';

import {
  BOTTLING_MAX_SUGAR_G_PER_L,
  BOTTLING_MIN_ALCOHOL_PCT,
  FERMENTATION_VIABLE_YEAST_ACTIVITY,
  MAX_PRESS_YIELD_ML_PER_KG,
  MIN_PRESS_YIELD_ML_PER_KG,
  bottleLot,
  blendLots,
  canBottle,
  configureFermentation,
  pressLot,
  splitLot,
} from '../../src/game/wine/Operations';
import { createHarvestLot, deriveHarvestAnchors } from '../../src/game/wine/Anchors';
import { GRAPES } from '../../src/game/vineyard/Catalog';
import type { GrapeId, SiteId, Vineyard } from '../../src/game/vineyard/types';
import type { PhysicalLot, WineOrigin } from '../../src/game/wine/types';

function vineyard(overrides: Partial<Vineyard> = {}): Vineyard {
  return {
    id: 'vineyard-hillside',
    name: 'North Slope',
    siteId: 'hillside',
    grapeId: 'pinot-noir',
    areaHa: 2,
    plantedYear: 2028,
    cropYear: 2030,
    ripeness: 0.82,
    condition: 0.91,
    cropKg: 7_000,
    harvestedKg: 0,
    rot: 0.08,
    nobleRot: 0.04,
    ...overrides,
  };
}

function origin(sourceVineyard: Vineyard, terroirPotential = 0.7, originPrestige = 0.62): WineOrigin {
  return {
    vineyardId: sourceVineyard.id,
    vineyardName: sourceVineyard.name,
    region: sourceVineyard.siteId === 'riverbend' ? 'Lower Valley' : 'Upper Valley',
    siteId: sourceVineyard.siteId,
    grapeId: sourceVineyard.grapeId,
    vintage: sourceVineyard.cropYear,
    terroirPotential,
    originPrestige,
  };
}

function harvestLot(
  id = 'lot-pinot',
  grapeId: GrapeId = 'pinot-noir',
  siteId: SiteId = 'hillside',
  week = 1,
): PhysicalLot {
  const sourceVineyard = vineyard({
    id: `vineyard-${id}`,
    name: `Vineyard ${id}`,
    grapeId,
    siteId,
  });
  return createHarvestLot({
    id,
    wineId: `wine-${grapeId}`,
    name: `${GRAPES[grapeId].name} ${sourceVineyard.cropYear}`,
    origin: origin(sourceVineyard),
    vineyard: sourceVineyard,
    week,
  });
}

function wineLot(lot: PhysicalLot, overrides: Partial<PhysicalLot['physical']> = {}): PhysicalLot {
  return {
    ...lot,
    form: 'wine',
    physical: {
      ...lot.physical,
      sugarGPerL: 3,
      alcoholPct: 12,
      ageDays: 28,
      ...overrides,
    },
    processes: { ...lot.processes, fermenting: false },
  };
}

describe('wine physical operations', () => {
  it('derives bounded, deterministic harvest anchors from grape, vineyard and terroir inputs', () => {
    const grapes = vineyard();
    const grape = GRAPES[grapes.grapeId];
    const anchors = deriveHarvestAnchors(grapes, grape, 0.7);

    expect(deriveHarvestAnchors(grapes, grape, 0.7)).toEqual(anchors);
    expect(anchors.sugarGPerL).toBeGreaterThan(0);
    for (const value of [anchors.acidity, anchors.phenolics, anchors.aromatics, anchors.body, anchors.agingPotential]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    expect(() => deriveHarvestAnchors(grapes, grape, 1.01)).toThrow(/Terroir Potential/);
  });

  it('creates harvest grapes with source lineage but no inventory amount', () => {
    const lot = harvestLot();

    expect(lot.form).toBe('grapes');
    expect(lot.sources).toEqual([{ origin: lot.origin, anchors: lot.anchors, fraction: 1 }]);
    expect(lot.anchors).toEqual(deriveHarvestAnchors(vineyard({ id: lot.origin.vineyardId, name: lot.origin.vineyardName }), GRAPES[lot.origin.grapeId], lot.origin.terroirPotential));
    expect(lot).not.toHaveProperty('quantity');
    expect(lot).not.toHaveProperty('amount');
  });

  it('presses grapes to finite must yield and never extracts beyond inherited phenolic capacity', () => {
    const grapes = harvestLot();
    const anchors = structuredClone(grapes.anchors);
    const gentle = pressLot(grapes, 0, true, false, 2);
    const firm = pressLot(grapes, 1, false, true, 2);

    expect(gentle.ok).toBe(true);
    expect(firm.ok).toBe(true);
    if (!gentle.ok || !firm.ok) throw new Error('Expected pressing to succeed.');
    expect(gentle.value.lot.form).toBe('must');
    expect(gentle.value.mlPerKg).toBeGreaterThanOrEqual(MIN_PRESS_YIELD_ML_PER_KG);
    expect(firm.value.mlPerKg).toBeLessThanOrEqual(MAX_PRESS_YIELD_ML_PER_KG);
    expect(firm.value.mlPerKg).toBeGreaterThan(gentle.value.mlPerKg);
    expect(firm.value.lot.physical.phenolics + firm.value.lot.physical.remainingPhenolics).toBeLessThanOrEqual(anchors.phenolics + 1e-9);
    expect(firm.value.lot.physical.oxygenExposure).toBeGreaterThan(gentle.value.lot.physical.oxygenExposure);
    expect(firm.value.lot.anchors).toEqual(anchors);
    expect(grapes.anchors).toEqual(anchors);
    expect(grapes.history).toHaveLength(1);
    expect(firm.value.lot.history.at(-1)?.action).toBe('pressed');
  });

  it('rejects invalid press ranges, non-grape forms and invalid process settings', () => {
    const grapes = harvestLot();
    expect(pressLot(grapes, Number.NaN, true, false, 2).ok).toBe(false);
    expect(pressLot(grapes, 1.1, true, false, 2).ok).toBe(false);
    expect(pressLot(wineLot(grapes), 0.5, true, false, 2).ok).toBe(false);

    const pressed = pressLot(grapes, 0.5, true, false, 2);
    if (!pressed.ok) throw new Error('Expected pressing to succeed.');
    const configured = configureFermentation(pressed.value.lot, {
      temperatureC: 21,
      skinContact: false,
      leesContact: true,
    }, 3);
    expect(configured.ok).toBe(true);
    if (!configured.ok) throw new Error('Expected fermentation configuration to succeed.');
    expect(configured.value.processes.fermenting).toBe(true);
    expect(configured.value.physical.yeastActivity).toBeGreaterThanOrEqual(FERMENTATION_VIABLE_YEAST_ACTIVITY);
    expect(configureFermentation(pressed.value.lot, {
      temperatureC: 41,
      skinContact: false,
      leesContact: true,
    }, 3).ok).toBe(false);
  });

  it('lets dry wine change settings without creating sugar or restarting fermentation', () => {
    const dryBase = wineLot(harvestLot(), { sugarGPerL: 2.5, yeastActivity: 0.05 });
    const dry = { ...dryBase, processes: { ...dryBase.processes, fermenting: true } };
    const controlled = configureFermentation(dry, {
      temperatureC: 16,
      skinContact: true,
      leesContact: true,
    }, 4);

    expect(controlled.ok).toBe(true);
    if (!controlled.ok) throw new Error('Expected dry-wine settings to succeed.');
    expect(controlled.value.processes.fermenting).toBe(false);
    expect(controlled.value.physical.sugarGPerL).toBe(2.5);
    expect(controlled.value.physical.yeastActivity).toBe(0.05);
  });

  it('splits a lot into a distinct copy with independent state and preserved source lineage', () => {
    const source = wineLot(harvestLot());
    const child = splitLot(source, 'lot-pinot-split', 5);

    expect(child.id).toBe('lot-pinot-split');
    expect(child.parentIds).toEqual([source.id]);
    expect(child.physical).toEqual(source.physical);
    expect(child.anchors).toEqual(source.anchors);
    expect(child.sources).toEqual(source.sources);
    expect(child.physical).not.toBe(source.physical);
    expect(child.anchors).not.toBe(source.anchors);
    expect(source.history.at(-1)?.action).toBe('harvested');
    expect(child.history.at(-1)?.action).toBe('split');
    expect(() => splitLot(source, source.id, 5)).toThrow(/different from its parent/);
  });

  it('blends full physical state and anchors by quantity while preserving normalized source shares', () => {
    const first = wineLot(harvestLot('lot-pinot', 'pinot-noir'), {
      sugarGPerL: 3,
      alcoholPct: 11,
      acidity: 0.2,
      phenolics: 0.1,
      remainingPhenolics: 0.3,
      aroma: 0.4,
      yeastActivity: 0.2,
      oxygenExposure: 0.1,
      oxidation: 0.05,
      maturation: 0.3,
      oak: 0.1,
      lees: 0.2,
      greenCharacter: 0.1,
      rot: 0.02,
      ageDays: 20,
    });
    const second = wineLot(harvestLot('lot-tempranillo', 'tempranillo', 'riverbend'), {
      sugarGPerL: 7,
      alcoholPct: 13,
      acidity: 0.8,
      phenolics: 0.4,
      remainingPhenolics: 0.25,
      aroma: 0.9,
      yeastActivity: 0.8,
      oxygenExposure: 0.9,
      oxidation: 0.6,
      maturation: 0.7,
      oak: 0.4,
      lees: 0.8,
      greenCharacter: 0.7,
      rot: 0.3,
      ageDays: 60,
    });
    const result = blendLots([
      { lot: first, quantity: 200 },
      { lot: second, quantity: 800 },
    ], 'lot-blend', 'House Blend', 6);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.value.physical.alcoholPct).toBeCloseTo(12.6);
    expect(result.value.physical.acidity).toBeCloseTo(0.68);
    expect(result.value.physical.ageDays).toBe(52);
    expect(result.value.anchors.acidity).toBeCloseTo(first.anchors.acidity * 0.2 + second.anchors.acidity * 0.8);
    expect(result.value.origin.vineyardId).toBe(second.origin.vineyardId);
    expect(result.value.parentIds).toEqual([first.id, second.id]);
    expect(result.value.sources.map(source => source.fraction)).toEqual([0.2, 0.8]);
    expect(result.value.sources.reduce((sum, source) => sum + source.fraction, 0)).toBeCloseTo(1);
    expect(result.value.physical.phenolics).toBeLessThanOrEqual(result.value.anchors.phenolics);
  });

  it('rejects invalid blend amounts and incompatible liquid forms', () => {
    const wine = wineLot(harvestLot());
    const must = pressLot(harvestLot('lot-must'), 0.4, true, false, 2);
    if (!must.ok) throw new Error('Expected pressing to succeed.');

    expect(blendLots([{ lot: wine, quantity: 0 }, { lot: wineLot(harvestLot('lot-two')), quantity: 1 }], 'blend', 'Blend', 4).ok).toBe(false);
    expect(blendLots([{ lot: wine, quantity: 1 }, { lot: must.value.lot, quantity: 1 }], 'blend', 'Blend', 4).ok).toBe(false);
    expect(blendLots([{ lot: wine, quantity: 1 }, { lot: wine, quantity: 1 }], 'blend', 'Blend', 4).ok).toBe(false);
  });

  it('gives a blend its own identity and resolves equal shares independently of input order', () => {
    const first = { lot: wineLot(harvestLot('lot-a', 'pinot-noir')), quantity: 500 };
    const second = { lot: wineLot(harvestLot('lot-b', 'chardonnay')), quantity: 500 };
    const forward = blendLots([first, second], 'lot-blend', 'House Blend', 6);
    const reverse = blendLots([second, first], 'lot-blend', 'House Blend', 6);
    expect(forward).toEqual(reverse);
    expect(forward.ok && forward.value.wineId).toBe('lot-blend');
  });

  it('keeps shared split ancestry in parent lots without multiplying the blended history', () => {
    let source = wineLot(harvestLot('lot-source'));
    const originalHistory = structuredClone(source.history);
    for (let cycle = 0; cycle < 20; cycle++) {
      const child = splitLot(source, `portion-${cycle}`, 6 + cycle);
      const result = blendLots([{ lot: source, quantity: 500 }, { lot: child, quantity: 500 }], `blend-${cycle}`, 'Recombined', 6 + cycle);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.reason);
      expect(result.value.history).toHaveLength(1);
      expect(result.value.parentIds).toEqual([source.id, child.id].sort());
      expect(result.value.history[0].detail).toContain(source.id);
      source = result.value;
    }
    expect(source.sources).toHaveLength(1);
    expect(originalHistory[0].action).toBe('harvested');
  });

  it('reports bottling blockers and preserves the development plus immutable assessment at bottling', () => {
    const raw = harvestLot();
    const anchors = structuredClone(raw.anchors);
    const dry = wineLot(raw, {
      sugarGPerL: BOTTLING_MAX_SUGAR_G_PER_L,
      alcoholPct: BOTTLING_MIN_ALCOHOL_PCT,
      oxidation: 0.13,
      maturation: 1.25,
      ageDays: 80,
    });
    const assessment = { week: 5, structure: 0.72, taste: 0.83, quality: 0.78 };
    expect(canBottle(dry)).toEqual({ ready: true, reasons: [] });

    const bottled = bottleLot(dry, 'lot-bottled', 5, assessment);
    expect(bottled.ok).toBe(true);
    if (!bottled.ok) throw new Error(bottled.reason);
    expect(bottled.value.form).toBe('bottled');
    expect(bottled.value.physical).toEqual(dry.physical);
    expect(bottled.value.anchors).toEqual(anchors);
    expect(bottled.value.bottling).toEqual(assessment);
    expect(bottled.value.bottling).not.toBe(assessment);
    expect(bottled.value.processes.fermenting).toBe(false);
    expect(bottled.value.processes.skinContact).toBe(false);
    expect(bottled.value.processes.leesContact).toBe(false);
    expect(dry.anchors).toEqual(anchors);
    expect(bottleLot(dry, 'bad-week', 6, assessment).ok).toBe(false);

    const blockers = wineLot(raw, { sugarGPerL: 5, alcoholPct: 4 });
    const readiness = canBottle(blockers);
    expect(readiness.ready).toBe(false);
    expect(readiness.reasons).toEqual(expect.arrayContaining([
      `Sugar must be at or below ${BOTTLING_MAX_SUGAR_G_PER_L} g/L.`,
      `Alcohol must be at least ${BOTTLING_MIN_ALCOHOL_PCT}%.`,
    ]));
    expect(canBottle({ ...blockers, processes: { ...blockers.processes, fermenting: true } }).ready).toBe(false);
  });
});
