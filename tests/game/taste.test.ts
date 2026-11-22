import { describe, expect, it } from 'vitest';
import { deriveTaste } from '../../src/game/evaluation/Taste';
import type { GrapeId } from '../../src/game/vineyard/types';
import type { PhysicalLot } from '../../src/game/wine/types';

function lot(grapeId: GrapeId = 'pinot-noir'): PhysicalLot {
  const origin = { vineyardId: 'v', vineyardName: 'Slope', region: 'Valley', siteId: 'hillside', grapeId, vintage: 2030, terroirPotential: 0.7, originPrestige: 0.6 } as const;
  const anchors = { sugarGPerL: 210, acidity: 0.7, phenolics: 0.6, aromatics: 0.8, body: 0.5, agingPotential: 0.7 } as const;
  return {
    id: 'lot', wineId: 'wine', name: 'Pinot', form: 'wine', origin, anchors,
    physical: { sugarGPerL: 20, alcoholPct: 11, acidity: 0.6, phenolics: 0.3, remainingPhenolics: 0.2, aroma: 0.7, yeastActivity: 0.5, oxygenExposure: 0, oxidation: 0, maturation: 0.2, oak: 0.1, lees: 0.1, greenCharacter: 0, rot: 0, ageDays: 30 },
    processes: { fermenting: false, skinContact: false, temperatureC: 18, leesContact: false },
    parentIds: [], sources: [{ origin, anchors, fraction: 1 }], history: [], bottling: null,
  };
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function withPhysical(input: PhysicalLot, changes: Partial<PhysicalLot['physical']>): PhysicalLot {
  return { ...input, physical: { ...input.physical, ...changes } };
}

describe('current taste projection', () => {
  it('is deterministic, bounded and leaves even frozen lot input untouched', () => {
    const input = deepFreeze(lot());
    const before = structuredClone(input);
    const first = deriveTaste(input);

    expect(deriveTaste(input)).toEqual(first);
    expect(input).toEqual(before);
    expect(Object.keys(first.families)).toEqual(['redFruit', 'darkFruit', 'citrus', 'floral', 'herbal', 'earth', 'oak', 'aged']);
    expect(first.descriptors.length).toBeLessThanOrEqual(5);
    for (const value of Object.values(first.families)) {
      expect(Number.isFinite(value) && value >= 0 && value <= 1).toBe(true);
    }

    const extreme = withPhysical(input, {
      sugarGPerL: 400, acidity: 1, phenolics: 1, remainingPhenolics: 0, aroma: 1,
      oxygenExposure: 1_000, oxidation: 1, maturation: 100, oak: 1, lees: 1,
      greenCharacter: 1, rot: 1, ageDays: 100_000,
    });
    for (const value of Object.values(deriveTaste(extreme).families)) {
      expect(Number.isFinite(value) && value >= 0 && value <= 1).toBe(true);
    }
  });

  it('uses source-grape identity and makes blend results independent of source ordering', () => {
    const pinot = lot('pinot-noir');
    const sauvignon = lot('sauvignon-blanc');
    const pinotSource = pinot.sources[0];
    const sauvignonSource = sauvignon.sources[0];
    const pinotProfile = deriveTaste(pinot).families;
    const sauvignonProfile = deriveTaste(sauvignon).families;
    expect(pinotProfile.redFruit).toBeGreaterThan(sauvignonProfile.redFruit);
    expect(sauvignonProfile.citrus).toBeGreaterThan(pinotProfile.citrus);

    const blendSources = [
      { ...pinotSource, fraction: 0.35 },
      { ...sauvignonSource, fraction: 0.65 },
    ];
    const blend = { ...pinot, sources: blendSources };
    const reversedBlend = { ...pinot, sources: [...blendSources].reverse() };
    expect(deriveTaste(blend)).toEqual(deriveTaste(reversedBlend));
    expect(deriveTaste(blend).families).not.toEqual(pinotProfile);
    expect(deriveTaste(blend).families).not.toEqual(sauvignonProfile);
  });

  it('responds to current aroma, phenolics, sugar, acidity, green character, risks and development', () => {
    const input = lot();
    const baseline = deriveTaste(input).families;

    const aromaDepleted = deriveTaste(withPhysical(input, { aroma: 0 })).families;
    expect(aromaDepleted.redFruit).toBeLessThan(baseline.redFruit);
    expect(aromaDepleted.floral).toBeLessThan(baseline.floral);

    const phenolic = deriveTaste(withPhysical(input, { phenolics: 0.8 })).families;
    expect(phenolic.darkFruit).toBeGreaterThan(baseline.darkFruit);
    expect(phenolic.earth).toBeGreaterThan(baseline.earth);

    const sweet = deriveTaste(withPhysical(input, { sugarGPerL: 90 })).families;
    expect(sweet.redFruit).toBeGreaterThan(baseline.redFruit);

    const bright = deriveTaste(withPhysical(input, { acidity: 0.95 })).families;
    expect(bright.citrus).toBeGreaterThan(baseline.citrus);

    const green = deriveTaste(withPhysical(input, { greenCharacter: 0.8 })).families;
    expect(green.herbal).toBeGreaterThan(baseline.herbal);
    expect(green.redFruit).toBeLessThan(baseline.redFruit);

    const oaked = deriveTaste(withPhysical(input, { oak: 0.8 })).families;
    expect(oaked.oak).toBeGreaterThan(baseline.oak);

    const mature = deriveTaste(withPhysical(input, { maturation: 1.4, ageDays: 730, lees: 0.8 })).families;
    expect(mature.aged).toBeGreaterThan(baseline.aged);
    expect(mature.earth).toBeGreaterThan(baseline.earth);
    expect(mature.redFruit).toBeLessThan(baseline.redFruit);

    const bottleAged = deriveTaste(withPhysical(input, { ageDays: 900 })).families;
    expect(bottleAged.aged).toBeGreaterThan(baseline.aged);
    expect(bottleAged.redFruit).toBeLessThan(baseline.redFruit);

    const risk = deriveTaste(withPhysical(input, { oxidation: 0.9, oxygenExposure: 1.2, rot: 0.9 })).families;
    expect(risk.redFruit).toBeLessThan(baseline.redFruit);
    expect(risk.aged).toBeGreaterThan(baseline.aged);
  });

  it('ignores price, origin prestige and historical bottling assessments', () => {
    const input = lot();
    const changed = {
      ...input,
      pricePerBottleCents: 123_456,
      origin: { ...input.origin, originPrestige: 0 },
      sources: input.sources.map(source => ({ ...source, origin: { ...source.origin, originPrestige: 1 } })),
      bottling: { week: 10, structure: 0.1, taste: 0.95, quality: 0.8 },
    };
    expect(deriveTaste(changed)).toEqual(deriveTaste(input));
  });
});
