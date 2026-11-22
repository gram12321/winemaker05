import { describe, expect, it } from 'vitest';

import { assessWine, ASSESSMENT_QUALITY_POLICY } from '../../src/game/evaluation/Assessment';
import { evaluateProfile } from '../../src/game/evaluation/MovingTargets';
import { structureTargets, tasteTargets } from '../../src/game/evaluation/Profiles';
import { deriveStructure } from '../../src/game/evaluation/Sensory';
import { deriveTaste } from '../../src/game/evaluation/Taste';
import { diagnoseWine } from '../../src/game/wine/Risks';
import type { PhysicalLot } from '../../src/game/wine/types';

function lot(): PhysicalLot {
  const origin = {
    vineyardId: 'vineyard-slope',
    vineyardName: 'North Slope',
    region: 'Upper Valley',
    siteId: 'hillside',
    grapeId: 'pinot-noir',
    vintage: 2030,
    terroirPotential: 0.7,
    originPrestige: 0.6,
  } as const;
  const anchors = {
    sugarGPerL: 215,
    acidity: 0.68,
    phenolics: 0.57,
    aromatics: 0.74,
    body: 0.54,
    agingPotential: 0.66,
  } as const;

  return {
    id: 'lot-pinot',
    wineId: 'wine-pinot',
    name: 'Pinot Noir 2030',
    form: 'wine',
    origin,
    anchors,
    physical: {
      sugarGPerL: 20,
      alcoholPct: 12,
      acidity: 0.6,
      phenolics: 0.3,
      remainingPhenolics: 0.27,
      aroma: 0.7,
      yeastActivity: 0.35,
      oxygenExposure: 0,
      oxidation: 0,
      maturation: 0.25,
      oak: 0.12,
      lees: 0.18,
      greenCharacter: 0,
      rot: 0,
      ageDays: 90,
    },
    processes: { fermenting: false, skinContact: false, temperatureC: 18, leesContact: false },
    parentIds: [],
    sources: [{ origin, anchors, fraction: 1 }],
    history: [],
    bottling: null,
  };
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function expectNormalizedProfile(profile: ReturnType<typeof evaluateProfile>): void {
  expect(Number.isFinite(profile.score) && profile.score >= 0 && profile.score <= 1).toBe(true);
  for (const axis of Object.values(profile.axes)) {
    for (const value of [axis.value, axis.low, axis.high, axis.fit]) {
      expect(Number.isFinite(value) && value >= 0 && value <= 1).toBe(true);
    }
    expect(Number.isFinite(axis.weight) && axis.weight >= 0).toBe(true);
    expect(axis.reasons.every(reason => typeof reason === 'string')).toBe(true);
  }
}

describe('current wine assessment', () => {
  it('composes both real profiles through the shared evaluator and retains explanations', () => {
    const input = lot();
    const assessment = assessWine(input);
    const structureProfile = deriveStructure(input);
    const tasteProfile = deriveTaste(input);

    expect(assessment.structure).toEqual(evaluateProfile(
      structureProfile,
      structureTargets(input, structureProfile),
    ));
    expect(assessment.taste).toEqual(evaluateProfile(
      tasteProfile.families,
      tasteTargets(input, tasteProfile.families),
    ));
    expect(assessment.descriptors).toEqual(tasteProfile.descriptors);
    expect(assessment.faults).toEqual(diagnoseWine(input));
    expect(Object.keys(assessment.structure.axes)).toEqual([
      'acidity', 'aroma', 'body', 'spice', 'sweetness', 'tannins',
    ]);
    expect(Object.keys(assessment.taste.axes)).toEqual([
      'aged', 'citrus', 'darkFruit', 'earth', 'floral', 'herbal', 'oak', 'redFruit',
    ]);
    expect(assessment.structure.axes.acidity.reasons.length).toBeGreaterThan(0);
    expect(assessment.taste.axes.redFruit.reasons.length).toBeGreaterThan(0);
    expect(assessment.descriptors.length).toBeGreaterThan(0);
  });

  it('returns normalized, repeatable assessments without mutating the lot', () => {
    const input = deepFreeze(lot());
    const before = structuredClone(input);
    const first = assessWine(input);

    expect(assessWine(input)).toEqual(first);
    expect(input).toEqual(before);
    expect(Object.isFrozen(input.physical)).toBe(true);
    expectNormalizedProfile(first.structure);
    expectNormalizedProfile(first.taste);
    expect(Number.isFinite(first.quality) && first.quality >= 0 && first.quality <= 1).toBe(true);
  });

  it('reduces summary quality once for physical fault severity without changing structural fit', () => {
    const input = lot();
    const oxidized = {
      ...input,
      physical: { ...input.physical, oxygenExposure: 1.2, oxidation: 0.8 },
    };
    const baseline = assessWine(input);
    const damaged = assessWine(oxidized);

    expect(damaged.structure).toEqual(baseline.structure);
    expect(damaged.faults).toEqual([
      expect.objectContaining({ code: 'oxidation', severity: 0.8 }),
    ]);
    expect(damaged.quality).toBeCloseTo(
      damaged.structure.score * (1 - ASSESSMENT_QUALITY_POLICY.maximumFaultReductionShare * 0.8),
    );
    expect(damaged.quality).toBeLessThan(baseline.quality);
  });

  it('keeps taste fit independent from summary quality when the structural profile is unchanged', () => {
    const input = lot();
    const lessGreen = {
      ...input,
      physical: { ...input.physical, greenCharacter: 0.05 },
    };
    const moreGreen = {
      ...input,
      physical: { ...input.physical, greenCharacter: 0.25 },
    };
    const first = assessWine(lessGreen);
    const second = assessWine(moreGreen);

    expect(second.structure).toEqual(first.structure);
    expect(second.taste).not.toEqual(first.taste);
    expect(first.faults).toEqual([]);
    expect(second.faults).toEqual([]);
    expect(second.quality).toBe(first.quality);
  });

  it('ignores origin prestige and historical bottling scores when deriving current assessment', () => {
    const input = lot();
    const changedContext = {
      ...input,
      origin: { ...input.origin, originPrestige: 1 },
      sources: input.sources.map(source => ({
        ...source,
        origin: { ...source.origin, originPrestige: 0 },
      })),
      bottling: { week: 40, structure: 0.05, taste: 0.99, quality: 0.9 },
    };
    const expectedSnapshot = structuredClone(changedContext.bottling);

    expect(assessWine(changedContext)).toEqual(assessWine(input));
    expect(changedContext.bottling).toEqual(expectedSnapshot);
  });
});
