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
      developmentAgeDays: 90,
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
      expect(target.reasons[1]).toContain('Combined target displacement from that base is');
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

  it('applies the movement cap to source-weighted blend context and interaction together', () => {
    const pinot = lot('pinot-noir', { ...ANCHORS, body: 0 });
    const tempranillo = lot('tempranillo', { ...ANCHORS, body: 1 });
    const sources = [
      { ...pinot.sources[0], fraction: 0.25 },
      { ...tempranillo.sources[0], fraction: 0.75 },
    ];
    const blend = { ...pinot, sources };
    const reversedBlend = { ...pinot, sources: [...sources].reverse() };
    const neutralBlend = {
      ...blend,
      sources: sources.map(source => ({
        ...source,
        anchors: { ...source.anchors, body: 0.5 },
      })),
    };
    const noInteractionProfile = { ...STRUCTURE_PROFILE, tannins: 0.2 };
    const interactingProfile = { ...STRUCTURE_PROFILE, tannins: 1 };
    const baseCenter = midpoint(structureTargets(neutralBlend, noInteractionProfile).body);
    const targets = structureTargets(blend, interactingProfile);

    expect(targets).toEqual(structureTargets(reversedBlend, interactingProfile));
    expect(midpoint(targets.body) - baseCenter).toBeCloseTo(TARGET_PROFILE_BALANCE.maximumTotalShiftPerAxis);
    expect(targets.body.reasons[0]).toContain('Pinot Noir 25.00%');
    expect(targets.body.reasons[0]).toContain('Tempranillo 75.00%');
    expect(targets.body.reasons[1]).toContain('Source-anchor context movement from the source-weighted base is +0.030');
    expect(targets.body.reasons[1]).toContain('requested +0.210');
    expect(targets.body.reasons[1]).toContain('axis movement budget +/-0.120 limits the combined shift to +0.120');
  });

  it('raises the body target for high tannins without shifting tannins or excusing extreme tannins', () => {
    const input = lot();
    const lowTanninProfile = { ...STRUCTURE_PROFILE, tannins: 0.2 };
    const highTanninProfile = { ...STRUCTURE_PROFILE, tannins: 1 };
    const lowTargets = structureTargets(input, lowTanninProfile);
    const highTargets = structureTargets(input, highTanninProfile);
    const noAnchorShift = structureTargets(
      lot('pinot-noir', { ...ANCHORS, body: 0.5 }),
      lowTanninProfile,
    );

    expect(midpoint(highTargets.body)).toBeGreaterThan(midpoint(lowTargets.body));
    expect(midpoint(highTargets.body) - midpoint(noAnchorShift.body)).toBeCloseTo(
      TARGET_PROFILE_BALANCE.maximumTotalShiftPerAxis,
    );
    expect(highTargets.tannins.low).toBe(lowTargets.tannins.low);
    expect(highTargets.tannins.high).toBe(lowTargets.tannins.high);
    expect(evaluateProfile(highTanninProfile, highTargets).axes.tannins.fit).toBe(0);
    expect(highTargets.body.reasons[1]).toContain('Cross-axis movement: +0.180 requested. High tannin expression (1.00)');
    expect(highTargets.body.reasons[1]).toContain('Source-anchor context movement from the source-weighted base is +0.005');
    expect(highTargets.body.reasons[1]).toContain('requested +0.185');
    expect(highTargets.body.reasons[1]).toContain('axis movement budget +/-0.120 limits the combined shift to +0.120');
    expect(highTargets.body.reasons[1]).not.toContain('target-center bounds');
  });

  it('caps negative anchor and interaction movement as a signed combined shift', () => {
    const noAnchorShift = structureTargets(
      lot('tempranillo', { ...ANCHORS, acidity: 0.5 }),
      { ...STRUCTURE_PROFILE, sweetness: 0.4 },
    );
    const targets = structureTargets(
      lot('tempranillo', { ...ANCHORS, acidity: 0 }),
      { ...STRUCTURE_PROFILE, sweetness: 1 },
    );

    expect(midpoint(targets.acidity) - midpoint(noAnchorShift.acidity)).toBeCloseTo(
      -TARGET_PROFILE_BALANCE.maximumTotalShiftPerAxis,
    );
    expect(targets.acidity.reasons[1]).toContain('Cross-axis movement: -0.080 requested.');
    expect(targets.acidity.reasons[1]).toContain('Source-anchor context movement from the source-weighted base is -0.050');
    expect(targets.acidity.reasons[1]).toContain('requested -0.130');
    expect(targets.acidity.reasons[1]).toContain('axis movement budget +/-0.120 limits the combined shift to -0.120');
  });

  it('lets an opposite-sign interaction cancel source-anchor movement within the signed budget', () => {
    const sourceWeightedBase = structureTargets(
      lot('tempranillo', { ...ANCHORS, acidity: 0.5 }),
      { ...STRUCTURE_PROFILE, sweetness: 0.4 },
    );
    const targets = structureTargets(
      lot('tempranillo', { ...ANCHORS, acidity: 1 }),
      { ...STRUCTURE_PROFILE, sweetness: 1 },
    );

    expect(midpoint(targets.acidity) - midpoint(sourceWeightedBase.acidity)).toBeCloseTo(-0.03);
    expect(targets.acidity.reasons[1]).toContain('Cross-axis movement: -0.080 requested.');
    expect(targets.acidity.reasons[1]).toContain('Source-anchor context movement from the source-weighted base is +0.050');
    expect(targets.acidity.reasons[1]).toContain('requested -0.030; final displacement -0.030');
    expect(targets.acidity.reasons[1]).not.toContain('axis movement budget');
  });

  it('reports a requested cross-axis shift clipped by target-center bounds separately from the movement budget', () => {
    const input = lot('tempranillo', { ...ANCHORS, body: 1 });
    const noInteraction = structureTargets(input, { ...STRUCTURE_PROFILE, tannins: 0.58 });
    const profile = { ...STRUCTURE_PROFILE, tannins: 0.75 };
    const targets = structureTargets(input, profile);

    expect(midpoint(targets.body) - midpoint(noInteraction.body)).toBeCloseTo(0.06);
    expect(targets.body.reasons[1]).toContain('Cross-axis movement: +0.102 requested.');
    expect(targets.body.reasons[1]).toContain(
      'target-center bounds [0.20, 0.80] cap the unbudgeted request at +0.120',
    );
    expect(targets.body.reasons[1]).toContain(
      'axis movement budget +/-0.120 limits the combined shift to +0.120',
    );
  });

  it('reports an anchor shift that is entirely clipped by the target-center bound', () => {
    const input = lot('sauvignon-blanc', { ...ANCHORS, aromatics: 1 });
    const target = structureTargets(input, STRUCTURE_PROFILE).aroma;

    expect(target.reasons[0]).toContain('aromatic anchor 1.00 requests center shift +0.050');
    expect(target.reasons[0]).toContain(
      'target-center bounds [0.20, 0.80] limit the applied shift to +0.000',
    );
  });

  it('rejects a lot without source provenance instead of synthesizing a fallback source', () => {
    const sourceLessLot = { ...lot(), sources: [] };

    expect(() => structureTargets(sourceLessLot, STRUCTURE_PROFILE)).toThrow(RangeError);
    expect(() => tasteTargets(sourceLessLot, TASTE_PROFILE)).toThrow(RangeError);
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
      expect(baselineTargets[axis].reasons[1]).toContain('Combined target displacement from that base is');
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
