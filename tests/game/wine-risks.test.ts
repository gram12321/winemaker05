import { describe, expect, it } from 'vitest';

import { createHarvestLot } from '../../src/game/wine/Anchors';
import { MIN_FERMENTABLE_SUGAR_G_PER_L } from '../../src/game/wine/Operations';
import {
  GREEN_CHARACTER_DIAGNOSIS_THRESHOLD,
  OXIDATION_DIAGNOSIS_THRESHOLD,
  ROT_DIAGNOSIS_THRESHOLD,
  SEVERE_OXIDATION_THRESHOLD,
  SEVERE_ROT_THRESHOLD,
  STUCK_FERMENTATION_YEAST_ACTIVITY_THRESHOLD,
  STUCK_FERMENTATION_SUGAR_PENALTY_RANGE_G_PER_L,
  advanceRisks,
  diagnoseWine,
  hasSeverePhysicalFault,
  physicalRiskPenaltyIntensity,
} from '../../src/game/wine/Risks';
import { GRAPES } from '../../src/game/vineyard/Catalog';
import type { PhysicalLot, PhysicalState, WineEnvironment } from '../../src/game/wine/types';
import type { Vineyard } from '../../src/game/vineyard/types';

function vineyard(): Vineyard {
  return {
    id: 'vineyard-risks',
    name: 'Risk Test Vineyard',
    siteId: 'hillside',
    grapeId: 'pinot-noir',
    areaHa: 1,
    plantedYear: 2020,
    cropYear: 2030,
    ripeness: 0.82,
    condition: 0.8,
    cropKg: 1_000,
    harvestedKg: 0,
    lostKg: 0,
    ripeKg: 700,
    rot: 0.04,
    nobleRot: 0.01,
  };
}

function lot(
  physicalOverrides: Partial<PhysicalState> = {},
  fermenting = false,
): PhysicalLot {
  const source = vineyard();
  const harvested = createHarvestLot({
    id: 'lot-risks',
    wineId: 'wine-risks',
    name: `${GRAPES[source.grapeId].name} ${source.cropYear}`,
    origin: {
      vineyardId: source.id,
      vineyardName: source.name,
      region: 'Upper Valley',
      siteId: source.siteId,
      grapeId: source.grapeId,
      vintage: source.cropYear,
      terroirPotential: 0.7,
      originPrestige: 0.6,
    },
    vineyard: source,
    week: 0,
  });
  return {
    ...harvested,
    form: 'must',
    physical: {
      ...harvested.physical,
      sugarGPerL: 80,
      yeastActivity: 0.12,
      ...physicalOverrides,
    },
    processes: { ...harvested.processes, fermenting },
  };
}

function environment(overrides: Partial<WineEnvironment> = {}): WineEnvironment {
  return {
    temperatureC: 15,
    oxygenIngress: 0,
    oakStrength: 0,
    contaminationRisk: 0,
    ...overrides,
  };
}

describe('causal wine risks', () => {
  it('is deterministic, does not mutate its lot, and matches partitioned daily advancement', () => {
    const source = lot({ oxygenExposure: 0.1, oxidation: 0.08, rot: 0.1, greenCharacter: 0.4 });
    const before = structuredClone(source);
    const climate = environment({ temperatureC: 21, oxygenIngress: 0.006, contaminationRisk: 0.4 });

    const full = advanceRisks(source, climate, 9);
    const firstPart = advanceRisks(source, climate, 4);
    const partitioned = advanceRisks({ ...source, physical: firstPart }, climate, 5);

    expect(advanceRisks(source, climate, 9)).toEqual(full);
    expect(partitioned).toEqual(full);
    expect(source).toEqual(before);
    expect(full).not.toBe(source.physical);
  });

  it('adds only ingress-driven oxygen exposure and never reduces oxidation under greater ingress', () => {
    const source = lot({ oxygenExposure: 0.2, oxidation: 0.1 });
    const noIngress = advanceRisks(source, environment(), 30);
    const lower = advanceRisks(source, environment({ oxygenIngress: 0.002 }), 30);
    const higher = advanceRisks(source, environment({ oxygenIngress: 0.006 }), 30);

    expect(noIngress.oxygenExposure).toBe(source.physical.oxygenExposure);
    expect(noIngress.oxidation).toBe(source.physical.oxidation);
    expect(higher.oxygenExposure).toBeGreaterThan(lower.oxygenExposure);
    expect(higher.oxidation).toBeGreaterThan(lower.oxidation);
    expect(higher.oxidation).toBeLessThanOrEqual(1);
  });

  it('grows rot only under contamination pressure and a warm or sugary condition', () => {
    const source = lot({ rot: 0.1, sugarGPerL: 0 });
    const pressureFree = advanceRisks(source, environment({ temperatureC: 24 }), 30);
    const coolDry = advanceRisks(source, environment({ temperatureC: 12, contaminationRisk: 1 }), 30);
    const pressuredWarm = advanceRisks(source, environment({ temperatureC: 24, contaminationRisk: 0.7 }), 30);
    const pressuredSugary = advanceRisks(
      lot({ rot: 0.1, sugarGPerL: MIN_FERMENTABLE_SUGAR_G_PER_L + 1 }),
      environment({ temperatureC: 12, contaminationRisk: 0.7 }),
      30,
    );

    expect(pressureFree.rot).toBe(source.physical.rot);
    expect(coolDry.rot).toBe(source.physical.rot);
    expect(pressuredWarm.rot).toBeGreaterThan(source.physical.rot);
    expect(pressuredSugary.rot).toBeGreaterThan(source.physical.rot);
    expect(pressuredWarm.rot).toBeLessThanOrEqual(1);
  });

  it('preserves fermentation, maturation, and inherited identity fields while updating risk-owned state', () => {
    const source = lot({
      sugarGPerL: 92,
      alcoholPct: 3.2,
      acidity: 0.61,
      phenolics: 0.08,
      remainingPhenolics: 0.21,
      aroma: 0.43,
      yeastActivity: 0.2,
      maturation: 0.31,
      oak: 0.17,
      lees: 0.26,
      ageDays: 35,
    }, true);
    const snapshot = structuredClone(source);
    const next = advanceRisks(source, environment({ oxygenIngress: 0.004, contaminationRisk: 0.6 }), 5);

    for (const field of [
      'sugarGPerL', 'alcoholPct', 'acidity', 'phenolics', 'remainingPhenolics',
      'aroma', 'yeastActivity', 'maturation', 'oak', 'lees', 'ageDays',
    ] as const) {
      expect(next[field]).toBe(snapshot.physical[field]);
    }
    expect(source.anchors).toEqual(snapshot.anchors);
    expect(source.origin).toEqual(snapshot.origin);
    expect(source.sources).toEqual(snapshot.sources);
    expect(source.processes).toEqual(snapshot.processes);
    expect(source.history).toEqual(snapshot.history);
    expect(source.physical).toEqual(snapshot.physical);
    expect(next.greenCharacter).toBeLessThan(source.physical.greenCharacter);
    expect(next.oxygenExposure).toBeGreaterThan(source.physical.oxygenExposure);
    expect(next.rot).toBeGreaterThan(source.physical.rot);
  });

  it('diagnoses oxidation, spoilage, and green character at named boundaries', () => {
    expect(diagnoseWine(lot({ oxidation: OXIDATION_DIAGNOSIS_THRESHOLD - 0.001 })).map(({ code }) => code))
      .not.toContain('oxidation');
    expect(diagnoseWine(lot({ oxidation: OXIDATION_DIAGNOSIS_THRESHOLD })).map(({ code }) => code))
      .toContain('oxidation');
    expect(diagnoseWine(lot({ rot: ROT_DIAGNOSIS_THRESHOLD })).map(({ code }) => code))
      .toContain('spoilage');
    expect(diagnoseWine(lot({ greenCharacter: GREEN_CHARACTER_DIAGNOSIS_THRESHOLD })).map(({ code }) => code))
      .toContain('green-character');

    for (const diagnosis of diagnoseWine(lot({ oxidation: 0.4, rot: 0.3, greenCharacter: 0.5 }))) {
      expect(diagnosis.severity).toBeGreaterThanOrEqual(0);
      expect(diagnosis.severity).toBeLessThanOrEqual(1);
      expect(diagnosis.explanation.length).toBeGreaterThan(10);
    }
  });

  it('starts each physical risk penalty at zero on its diagnosis threshold and bounds the strongest risk', () => {
    for (const [field, threshold] of [
      ['oxidation', OXIDATION_DIAGNOSIS_THRESHOLD],
      ['rot', ROT_DIAGNOSIS_THRESHOLD],
      ['greenCharacter', GREEN_CHARACTER_DIAGNOSIS_THRESHOLD],
    ] as const) {
      expect(physicalRiskPenaltyIntensity(lot({ [field]: threshold }))).toBe(0);
      expect(physicalRiskPenaltyIntensity(lot({ [field]: threshold + 0.001 }))).toBeGreaterThan(0);
      expect(physicalRiskPenaltyIntensity(lot({ [field]: 1 }))).toBe(1);
    }

    const halfOxidation = OXIDATION_DIAGNOSIS_THRESHOLD
      + (1 - OXIDATION_DIAGNOSIS_THRESHOLD) * 0.5;
    const halfRot = ROT_DIAGNOSIS_THRESHOLD + (1 - ROT_DIAGNOSIS_THRESHOLD) * 0.5;
    const halfGreen = GREEN_CHARACTER_DIAGNOSIS_THRESHOLD
      + (1 - GREEN_CHARACTER_DIAGNOSIS_THRESHOLD) * 0.5;
    expect(physicalRiskPenaltyIntensity(lot({ oxidation: halfOxidation, rot: halfRot, greenCharacter: halfGreen })))
      .toBeCloseTo(0.5);
  });

  it('keeps stuck-fermentation penalty continuous at both edges while retaining diagnostic severity', () => {
    const sugarThreshold = MIN_FERMENTABLE_SUGAR_G_PER_L;
    const yeastThreshold = STUCK_FERMENTATION_YEAST_ACTIVITY_THRESHOLD;
    const sugarEdge = lot({ sugarGPerL: sugarThreshold, yeastActivity: 0 }, true);
    const yeastEdge = lot({ sugarGPerL: sugarThreshold + 20, yeastActivity: yeastThreshold }, true);
    const nearSugarEdge = lot({ sugarGPerL: sugarThreshold + 0.001, yeastActivity: yeastThreshold / 2 }, true);
    const atQuarterYeast = lot({ sugarGPerL: sugarThreshold + 20, yeastActivity: yeastThreshold * 0.75 }, true);
    const atHalfYeast = lot({ sugarGPerL: sugarThreshold + 20, yeastActivity: yeastThreshold / 2 }, true);
    const atFullSugarRange = lot({
      sugarGPerL: sugarThreshold + STUCK_FERMENTATION_SUGAR_PENALTY_RANGE_G_PER_L,
      yeastActivity: 0,
    }, true);

    expect(physicalRiskPenaltyIntensity(sugarEdge)).toBe(0);
    expect(physicalRiskPenaltyIntensity(yeastEdge)).toBe(0);
    expect(physicalRiskPenaltyIntensity(nearSugarEdge)).toBeGreaterThan(0);
    expect(physicalRiskPenaltyIntensity(atHalfYeast)).toBeGreaterThan(physicalRiskPenaltyIntensity(atQuarterYeast));
    expect(physicalRiskPenaltyIntensity(atFullSugarRange)).toBe(1);

    const diagnosis = diagnoseWine(atHalfYeast).find(({ code }) => code === 'stuck-fermentation');
    expect(diagnosis?.severity).toBeCloseTo(0.5);
    expect(physicalRiskPenaltyIntensity(atHalfYeast)).toBeCloseTo(0.25);
  });

  it('diagnoses stuck fermentation only above the shared sugar threshold with active fermentation and low yeast', () => {
    const stalled = diagnoseWine(lot({
      sugarGPerL: MIN_FERMENTABLE_SUGAR_G_PER_L + 0.1,
      yeastActivity: STUCK_FERMENTATION_YEAST_ACTIVITY_THRESHOLD - 0.001,
    }, true));
    const dry = diagnoseWine(lot({
      sugarGPerL: MIN_FERMENTABLE_SUGAR_G_PER_L,
      yeastActivity: 0,
    }, true));
    const enoughYeast = diagnoseWine(lot({
      sugarGPerL: MIN_FERMENTABLE_SUGAR_G_PER_L + 10,
      yeastActivity: STUCK_FERMENTATION_YEAST_ACTIVITY_THRESHOLD,
    }, true));
    const inactive = diagnoseWine(lot({
      sugarGPerL: MIN_FERMENTABLE_SUGAR_G_PER_L + 10,
      yeastActivity: 0,
    }, false));

    expect(stalled.map(({ code }) => code)).toContain('stuck-fermentation');
    expect(dry.map(({ code }) => code)).not.toContain('stuck-fermentation');
    expect(enoughYeast.map(({ code }) => code)).not.toContain('stuck-fermentation');
    expect(inactive.map(({ code }) => code)).not.toContain('stuck-fermentation');
  });

  it('marks only severe oxidation or rot as a severe physical fault', () => {
    expect(hasSeverePhysicalFault(lot({ oxidation: SEVERE_OXIDATION_THRESHOLD - 0.001 }))).toBe(false);
    expect(hasSeverePhysicalFault(lot({ oxidation: SEVERE_OXIDATION_THRESHOLD }))).toBe(true);
    expect(hasSeverePhysicalFault(lot({ rot: SEVERE_ROT_THRESHOLD }))).toBe(true);
    expect(hasSeverePhysicalFault(lot({ greenCharacter: 1, yeastActivity: 0 }, true))).toBe(false);

    const structurallyUnusual = lot({ acidity: 0, aroma: 0, phenolics: 0, sugarGPerL: 0, oxidation: 0, rot: 0 });
    expect(diagnoseWine(structurallyUnusual)).toEqual([]);
    expect(hasSeverePhysicalFault(structurallyUnusual)).toBe(false);
  });
});
