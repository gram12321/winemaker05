import { describe, expect, it } from 'vitest';
import { deriveStructure } from '../../src/game/evaluation/Sensory';
import type { PhysicalLot } from '../../src/game/wine/types';

function lot(): PhysicalLot {
  const origin = { vineyardId: 'v', vineyardName: 'Slope', region: 'Valley', siteId: 'hillside', grapeId: 'pinot-noir', vintage: 2030, terroirPotential: 0.7, originPrestige: 0.6 } as const;
  const anchors = { sugarGPerL: 210, acidity: 0.7, phenolics: 0.6, aromatics: 0.8, body: 0.5, agingPotential: 0.7 };
  return {
    id: 'lot', wineId: 'wine', name: 'Pinot', form: 'wine', origin, anchors,
    physical: { sugarGPerL: 20, alcoholPct: 11, acidity: 0.6, phenolics: 0.3, remainingPhenolics: 0.2, aroma: 0.7, yeastActivity: 0.5, oxygenExposure: 0, oxidation: 0, maturation: 0.2, oak: 0.1, lees: 0.1, greenCharacter: 0, rot: 0, ageDays: 30 },
    processes: { fermenting: false, skinContact: false, temperatureC: 18, leesContact: false },
    parentIds: [], sources: [{ origin, anchors, fraction: 1 }], history: [], bottling: null,
  };
}

describe('current sensory structure', () => {
  it('is deterministic, bounded and does not mutate the lot', () => {
    const input = lot();
    const before = structuredClone(input);
    const first = deriveStructure(input);
    expect(deriveStructure(input)).toEqual(first);
    expect(input).toEqual(before);
    expect(Object.keys(first)).toEqual(['acidity', 'aroma', 'body', 'spice', 'sweetness', 'tannins']);
    for (const value of Object.values(first)) expect(Number.isFinite(value) && value >= 0 && value <= 1).toBe(true);
    const extreme = deriveStructure({ ...input, physical: { ...input.physical, sugarGPerL: 400, alcoholPct: 25, oak: 1, maturation: 100, phenolics: 1, lees: 1 } });
    for (const value of Object.values(extreme)) expect(Number.isFinite(value) && value >= 0 && value <= 1).toBe(true);
  });

  it('projects current acidity, aroma and residual sugar rather than copying anchors', () => {
    const input = lot();
    const original = deriveStructure(input);
    const developed = deriveStructure({ ...input, physical: { ...input.physical, acidity: 0.3, aroma: 0.4, sugarGPerL: 2 } });
    expect(developed.acidity).toBe(0.3);
    expect(developed.aroma).toBe(0.4);
    expect(developed.sweetness).toBeLessThan(original.sweetness);
    expect(original.sweetness).not.toBe(input.physical.sugarGPerL);
    expect(deriveStructure({ ...input, physical: { ...input.physical, acidity: 0.9 } }).sweetness).toBeLessThan(original.sweetness);
  });

  it('responds to extracted phenolics, alcohol, lees, oak and maturation', () => {
    const input = lot();
    const original = deriveStructure(input);
    const developed = deriveStructure({ ...input, physical: { ...input.physical, phenolics: 0.5, remainingPhenolics: 0, alcoholPct: 13, lees: 0.5, oak: 0.5, maturation: 0.8 } });
    expect(developed.tannins).toBeGreaterThan(original.tannins);
    expect(developed.body).toBeGreaterThan(original.body);
    expect(developed.spice).toBeGreaterThan(original.spice);
    expect(deriveStructure({ ...input, physical: { ...input.physical, phenolics: 0 }, anchors: { ...input.anchors, phenolics: 1 } }).tannins).toBe(0);
  });

  it('uses the source varieties, including blended source proportions', () => {
    const input = lot();
    const tempranilloOrigin = { ...input.origin, grapeId: 'tempranillo' as const };
    const other = { origin: tempranilloOrigin, anchors: input.anchors, fraction: 1 };
    const pinot = deriveStructure(input).spice;
    const tempranillo = deriveStructure({ ...input, sources: [other] }).spice;
    const blend = deriveStructure({ ...input, sources: [{ ...input.sources[0], fraction: 0.5 }, { ...other, fraction: 0.5 }] }).spice;
    expect(tempranillo).toBeGreaterThan(pinot);
    expect(blend).toBeCloseTo((pinot + tempranillo) / 2);
  });

  it('softens perceived tannins during maturation while retaining the physical material', () => {
    const input = lot();
    const aged = { ...input, physical: { ...input.physical, maturation: 1 } };
    expect(deriveStructure(aged).tannins).toBeLessThan(deriveStructure(input).tannins);
    expect(aged.physical.phenolics).toBe(input.physical.phenolics);
    expect(aged.anchors).toEqual(input.anchors);
  });

  it('ignores bottling scores and commercial prestige', () => {
    const input = lot();
    const changed = { ...input, origin: { ...input.origin, originPrestige: 0 }, bottling: { week: 1, structure: 1, taste: 0, quality: 0.9 } };
    expect(deriveStructure(changed)).toEqual(deriveStructure(input));
  });
});
