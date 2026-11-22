import { describe, expect, it } from 'vitest';
import { evaluateProfile } from '../../src/game/evaluation/MovingTargets';
import {
  structureTargets,
  tasteTargets,
  TARGET_PROFILE_BALANCE,
} from '../../src/game/evaluation/Profiles';
import type {
  StructureAxis,
  StructureProfile,
  TasteFamily,
  TasteProfile,
  TargetProfile,
} from '../../src/game/evaluation/types';
import type { GrapeId, SiteId } from '../../src/game/vineyard/types';
import type { PhysicalLot, RawMaterialAnchors } from '../../src/game/wine/types';

const STRUCTURE_AXES: readonly StructureAxis[] = [
  'acidity', 'aroma', 'body', 'spice', 'sweetness', 'tannins',
];

const TASTE_FAMILIES: readonly TasteFamily[] = [
  'redFruit', 'darkFruit', 'citrus', 'floral', 'herbal', 'earth', 'oak', 'aged',
];

const STRUCTURE_PROFILE: StructureProfile = {
  acidity: 0.62,
  aroma: 0.68,
  body: 0.56,
  spice: 0.42,
  sweetness: 0.4,
  tannins: 0.5,
};

const TASTE_PROFILE: TasteProfile = {
  redFruit: 0.58,
  darkFruit: 0.42,
  citrus: 0.35,
  floral: 0.56,
  herbal: 0.39,
  earth: 0.42,
  oak: 0.32,
  aged: 0.5,
};

const ANCHORS: RawMaterialAnchors = {
  sugarGPerL: 215,
  acidity: 0.68,
  phenolics: 0.57,
  aromatics: 0.74,
  body: 0.54,
  agingPotential: 0.66,
};

function lot(grapeId: GrapeId = 'pinot-noir', anchors: RawMaterialAnchors = ANCHORS): PhysicalLot {
  const origin = {
    vineyardId: `vineyard-${grapeId}`,
    vineyardName: 'Slope',
    region: 'Upper Valley',
    siteId: 'hillside' as const,
    grapeId,
    vintage: 2030,
    terroirPotential: 0.7,
    originPrestige: 0.6,
  };
  return {
    id: `lot-${grapeId}`,
    wineId: `wine-${grapeId}`,
    name: grapeId,
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

function midpoint(target: TargetProfile[string]): number {
  return target.low + (target.high - target.low) / 2;
}

function expectValidTargets(
  values: Readonly<Record<string, number>>,
  targets: TargetProfile,
  axes: readonly string[],
): void {
  expect(Object.keys(targets)).toEqual(axes);
  expect(Object.keys(values)).toEqual(axes);
  for (const axis of axes) {
    const target = targets[axis];
    expect(Number.isFinite(target.low) && target.low >= 0).toBe(true);
    expect(Number.isFinite(target.high) && target.high <= 1).toBe(true);
    expect(target.low).toBeLessThanOrEqual(target.high);
    expect(target.high - target.low).toBeGreaterThanOrEqual(TARGET_PROFILE_BALANCE.minimumRangeWidth - 1e-10);
    expect(Number.isFinite(target.weight) && target.weight > 0).toBe(true);
    expect(target.reasons.every(reason => typeof reason === 'string')).toBe(true);
  }
  const assessment = evaluateProfile(values, targets);
  expect(Number.isFinite(assessment.score) && assessment.score >= 0 && assessment.score <= 1).toBe(true);
  for (const axis of axes) expect(assessment.axes[axis].reasons).toEqual(targets[axis].reasons);
}

describe('contextual bounded target profiles', () => {
  it('covers the exact structural and taste keys accepted by the shared evaluator', () => {
    const input = lot();
    const structural = structureTargets(input, STRUCTURE_PROFILE);
    const taste = tasteTargets(input, TASTE_PROFILE);

    expectValidTargets(STRUCTURE_PROFILE, structural, STRUCTURE_AXES);
    expectValidTargets(TASTE_PROFILE, taste, TASTE_FAMILIES);
    for (const target of [...Object.values(structural), ...Object.values(taste)]) {
      expect(target.reasons).toHaveLength(2);
      expect(target.reasons[0]).toContain('Baseline:');
      expect(target.reasons[1]).toContain('Applied cross-axis shift:');
    }
  });

  it('changes contextual targets for the same profile under different source varieties', () => {
    const pinot = lot('pinot-noir');
    const tempranillo = lot('tempranillo');

    expect(structureTargets(pinot, STRUCTURE_PROFILE)).not.toEqual(structureTargets(tempranillo, STRUCTURE_PROFILE));
    expect(tasteTargets(pinot, TASTE_PROFILE)).not.toEqual(tasteTargets(tempranillo, TASTE_PROFILE));
  });

  it('weights blend source baselines by fraction and is invariant to source ordering', () => {
    const pinot = lot('pinot-noir');
    const sauvignon = lot('sauvignon-blanc');
    const blendSources = [
      { ...pinot.sources[0], fraction: 0.3 },
      { ...sauvignon.sources[0], fraction: 0.7 },
    ];
    const blend = { ...pinot, sources: blendSources };
    const reversedBlend = { ...pinot, sources: [...blendSources].reverse() };

    const pinotStructure = structureTargets(pinot, STRUCTURE_PROFILE);
    const sauvignonStructure = structureTargets(sauvignon, STRUCTURE_PROFILE);
    const blendStructure = structureTargets(blend, STRUCTURE_PROFILE);
    const pinotTaste = tasteTargets(pinot, TASTE_PROFILE);
    const sauvignonTaste = tasteTargets(sauvignon, TASTE_PROFILE);
    const blendTaste = tasteTargets(blend, TASTE_PROFILE);

    expect(blendStructure).toEqual(structureTargets(reversedBlend, STRUCTURE_PROFILE));
    expect(blendTaste).toEqual(tasteTargets(reversedBlend, TASTE_PROFILE));
    expect(midpoint(blendStructure.body)).toBeCloseTo(
      0.3 * midpoint(pinotStructure.body) + 0.7 * midpoint(sauvignonStructure.body),
    );
    expect(midpoint(blendTaste.redFruit)).toBeCloseTo(
      0.3 * midpoint(pinotTaste.redFruit) + 0.7 * midpoint(sauvignonTaste.redFruit),
    );
    expect(blendStructure.body.reasons[0]).toContain('Pinot Noir 30.00%');
    expect(blendStructure.body.reasons[0]).toContain('Sauvignon Blanc 70.00%');
  });

  it('raises the body target for high tannins without shifting tannins or excusing extreme tannins', () => {
    const input = lot();
    const lowTanninProfile = { ...STRUCTURE_PROFILE, tannins: 0.2 };
    const highTanninProfile = { ...STRUCTURE_PROFILE, tannins: 1 };
    const lowTargets = structureTargets(input, lowTanninProfile);
    const highTargets = structureTargets(input, highTanninProfile);

    expect(midpoint(highTargets.body)).toBeGreaterThan(midpoint(lowTargets.body));
    expect(midpoint(highTargets.body) - midpoint(lowTargets.body)).toBeCloseTo(
      TARGET_PROFILE_BALANCE.maximumTotalShiftPerAxis,
    );
    expect(highTargets.tannins.low).toBe(lowTargets.tannins.low);
    expect(highTargets.tannins.high).toBe(lowTargets.tannins.high);
    expect(evaluateProfile(highTanninProfile, highTargets).axes.tannins.fit).toBe(0);
    expect(highTargets.body.reasons[1]).toContain('High tannin expression (1.00)');
    expect(highTargets.body.reasons[1]).toContain('bounded by the');
  });

  it('keeps extreme profiles bounded and enforces the minimum range width and movement cap', () => {
    const fullCapacity: RawMaterialAnchors = {
      sugarGPerL: 320,
      acidity: 1,
      phenolics: 1,
      aromatics: 1,
      body: 1,
      agingPotential: 1,
    };
    const input = lot('pinot-noir', fullCapacity);
    const allLowStructure: StructureProfile = {
      acidity: 0, aroma: 0, body: 0, spice: 0, sweetness: 0, tannins: 0,
    };
    const allHighStructure: StructureProfile = {
      acidity: 1, aroma: 1, body: 1, spice: 1, sweetness: 1, tannins: 1,
    };
    const allLowTaste: TasteProfile = {
      redFruit: 0, darkFruit: 0, citrus: 0, floral: 0, herbal: 0, earth: 0, oak: 0, aged: 0,
    };
    const allHighTaste: TasteProfile = {
      redFruit: 1, darkFruit: 1, citrus: 1, floral: 1, herbal: 1, earth: 1, oak: 1, aged: 1,
    };
    const baseline = structureTargets(input, { ...allHighStructure, tannins: 0 });
    const shifted = structureTargets(input, allHighStructure);
    const structural = structureTargets(input, allHighStructure);
    const taste = tasteTargets(input, allHighTaste);

    expectValidTargets(allLowStructure, structureTargets(input, allLowStructure), STRUCTURE_AXES);
    expectValidTargets(allLowTaste, tasteTargets(input, allLowTaste), TASTE_FAMILIES);
    expectValidTargets(allHighStructure, structural, STRUCTURE_AXES);
    expectValidTargets(allHighTaste, taste, TASTE_FAMILIES);
    expect(midpoint(shifted.body) - midpoint(baseline.body)).toBeLessThanOrEqual(
      TARGET_PROFILE_BALANCE.maximumTotalShiftPerAxis + 1e-10,
    );
    expect(structural.sweetness.high - structural.sweetness.low).toBeGreaterThanOrEqual(
      TARGET_PROFILE_BALANCE.minimumRangeWidth - 1e-10,
    );
    expect(structural.body.high - structural.body.low).toBeLessThanOrEqual(
      TARGET_PROFILE_BALANCE.maximumRangeWidth,
    );
  });

  it('leaves frozen inputs untouched and ignores commercial context while forwarding reasons', () => {
    const input = deepFreeze(lot());
    const structureProfile = deepFreeze({ ...STRUCTURE_PROFILE });
    const tasteProfile = deepFreeze({ ...TASTE_PROFILE });
    const before = structuredClone({ input, structureProfile, tasteProfile });
    const baselineTargets = structureTargets(input, structureProfile);
    const baselineTasteTargets = tasteTargets(input, tasteProfile);
    const changedOrigin = {
      ...input.origin,
      siteId: 'riverbend' as SiteId,
      terroirPotential: 0,
      originPrestige: 1,
    };
    const commercialLot: PhysicalLot & { readonly pricePerBottleCents: number } = {
      ...input,
      origin: changedOrigin,
      sources: input.sources.map(source => ({
        ...source,
        origin: { ...source.origin, siteId: 'riverbend' as SiteId, terroirPotential: 0, originPrestige: 0 },
      })),
      bottling: { week: 1, structure: 1, taste: 0, quality: 1 },
      pricePerBottleCents: 999_999,
    };
    const changedTargets = structureTargets(commercialLot, structureProfile);
    const changedTasteTargets = tasteTargets(commercialLot, tasteProfile);
    const assessment = evaluateProfile(structureProfile, baselineTargets);

    expect(baselineTargets).toEqual(changedTargets);
    expect(baselineTasteTargets).toEqual(changedTasteTargets);
    expect({ input, structureProfile, tasteProfile }).toEqual(before);
    for (const axis of STRUCTURE_AXES) {
      expect(baselineTargets[axis].reasons[0]).toContain('Baseline:');
      expect(baselineTargets[axis].reasons[1]).toContain('Applied cross-axis shift:');
      expect(assessment.axes[axis].reasons).toEqual(baselineTargets[axis].reasons);
    }
  });

  it('uses the original profile values independent of key declaration order', () => {
    const reverseOrderProfile: StructureProfile = {
      tannins: STRUCTURE_PROFILE.tannins,
      sweetness: STRUCTURE_PROFILE.sweetness,
      spice: STRUCTURE_PROFILE.spice,
      body: STRUCTURE_PROFILE.body,
      aroma: STRUCTURE_PROFILE.aroma,
      acidity: STRUCTURE_PROFILE.acidity,
    };

    expect(structureTargets(lot(), reverseOrderProfile)).toEqual(structureTargets(lot(), STRUCTURE_PROFILE));
  });
});
