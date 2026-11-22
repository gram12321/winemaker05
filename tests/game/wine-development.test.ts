import { describe, expect, it } from 'vitest';

import { GRAPES } from '../../src/game/vineyard/Catalog';
import type { GrapeId, Vineyard } from '../../src/game/vineyard/types';
import { createHarvestLot } from '../../src/game/wine/Anchors';
import {
  FERMENTATION_ALCOHOL_PCT_PER_G_PER_L_SUGAR,
  describeDevelopment,
  developLot,
} from '../../src/game/wine/Development';
import { advanceMaturation } from '../../src/game/wine/Maturation';
import {
  MIN_FERMENTABLE_SUGAR_G_PER_L,
  bottleLot,
  configureFermentation,
  pressLot,
} from '../../src/game/wine/Operations';
import { advanceRisks, diagnoseWine, STUCK_FERMENTATION_YEAST_ACTIVITY_THRESHOLD } from '../../src/game/wine/Risks';
import type { PhysicalLot, PhysicalState, WineEnvironment } from '../../src/game/wine/types';

function harvest(grapeId: GrapeId = 'pinot-noir'): PhysicalLot {
  const vineyard: Vineyard = {
    id: 'development-vineyard', name: 'Development Vineyard', siteId: 'hillside', grapeId,
    areaHa: 1, plantedYear: 2020, cropYear: 2030, ripeness: 0.9, condition: 0.9,
    cropKg: 1000, harvestedKg: 0, rot: 0.03, nobleRot: 0.01,
  };
  return createHarvestLot({
    id: `lot-${grapeId}`, wineId: `wine-${grapeId}`, name: GRAPES[grapeId].name,
    origin: {
      vineyardId: vineyard.id, vineyardName: vineyard.name, region: 'Upper Valley',
      siteId: vineyard.siteId, grapeId, vintage: vineyard.cropYear, terroirPotential: 0.7, originPrestige: 0.6,
    },
    vineyard,
    week: 0,
  });
}

function must(grapeId: GrapeId = 'pinot-noir', skinContact = true): PhysicalLot {
  const pressed = pressLot(harvest(grapeId), 0.35, true, skinContact, 1);
  if (!pressed.ok) throw new Error(pressed.reason);
  return pressed.value.lot;
}

function configure(lot: PhysicalLot, temperatureC = 20, skinContact = true): PhysicalLot {
  const configured = configureFermentation(lot, { temperatureC, skinContact, leesContact: true }, 2);
  if (!configured.ok) throw new Error(configured.reason);
  return configured.value;
}

function environment(overrides: Partial<WineEnvironment> = {}): WineEnvironment {
  return { temperatureC: 20, oxygenIngress: 0.001, oakStrength: 0.2, contaminationRisk: 0.05, ...overrides };
}

function withPhysical(lot: PhysicalLot, overrides: Partial<PhysicalState>): PhysicalLot {
  return { ...lot, physical: { ...lot.physical, ...overrides } };
}

function expectBounded(lot: PhysicalLot): void {
  for (const value of Object.values(lot.physical)) expect(Number.isFinite(value)).toBe(true);
  const { physical } = lot;
  for (const value of [physical.acidity, physical.phenolics, physical.remainingPhenolics, physical.aroma,
    physical.yeastActivity, physical.oxidation, physical.oak, physical.lees, physical.greenCharacter, physical.rot]) {
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(1);
  }
  expect(physical.sugarGPerL).toBeGreaterThanOrEqual(0);
  expect(physical.sugarGPerL).toBeLessThanOrEqual(400);
  expect(physical.alcoholPct).toBeGreaterThanOrEqual(0);
  expect(physical.alcoholPct).toBeLessThanOrEqual(30);
  expect(physical.oxygenExposure).toBeGreaterThanOrEqual(0);
  expect(physical.maturation).toBeGreaterThanOrEqual(0);
  expect(Number.isSafeInteger(physical.ageDays)).toBe(true);
  expect(physical.phenolics + physical.remainingPhenolics).toBeLessThanOrEqual(lot.anchors.phenolics + 1e-7);
}

describe('unified physical wine development', () => {
  it('converts only the consumed sugar into alcohol, advances age, and does not mutate the source', () => {
    const source = configure(must());
    const snapshot = structuredClone(source);
    const result = developLot(source, environment(), 7);
    const consumed = snapshot.physical.sugarGPerL - result.lot.physical.sugarGPerL;

    expect(consumed).toBeGreaterThan(0);
    expect(result.lot.physical.alcoholPct - snapshot.physical.alcoholPct)
      .toBeCloseTo(consumed * FERMENTATION_ALCOHOL_PCT_PER_G_PER_L_SUGAR, 12);
    expect(result.lot.physical.ageDays).toBe(snapshot.physical.ageDays + 7);
    expect(source).toEqual(snapshot);
    expect(result.lot.anchors).toEqual(snapshot.anchors);
    expect(result.lot.origin).toEqual(snapshot.origin);
    expect(result.lot.sources).toEqual(snapshot.sources);
    expect(result.lot.parentIds).toEqual(snapshot.parentIds);
    expect(result.lot.history).toEqual(snapshot.history);
    expect(result.lot.bottling).toEqual(snapshot.bottling);
    expect(result.causes).toEqual(describeDevelopment(source, result.lot));
    expect(result.causes.some(cause => cause.includes('Fermentation converted'))).toBe(true);
    expectBounded(result.lot);
  });

  it('finishes at exactly the shared sugar threshold and never consumes dry residual sugar', () => {
    const source = withPhysical(configure(must()), { sugarGPerL: 4.1, alcoholPct: 11, yeastActivity: 0.8 });
    const result = developLot(source, environment(), 3);
    expect(result.lot.physical.sugarGPerL).toBe(MIN_FERMENTABLE_SUGAR_G_PER_L);
    expect(result.lot.physical.alcoholPct - source.physical.alcoholPct)
      .toBeCloseTo((source.physical.sugarGPerL - MIN_FERMENTABLE_SUGAR_G_PER_L) * FERMENTATION_ALCOHOL_PCT_PER_G_PER_L_SUGAR, 12);
    expect(result.lot.form).toBe('wine');
    expect(result.lot.processes.fermenting).toBe(false);
    expect(result.causes.some(cause => cause.includes('Fermentation completed'))).toBe(true);

    const alreadyDry = withPhysical(source, { sugarGPerL: 2.5 });
    const finished = developLot(alreadyDry, environment(), 1).lot;
    expect(finished.physical.sugarGPerL).toBe(2.5);
    expect(finished.physical.alcoholPct).toBe(alreadyDry.physical.alcoholPct);
    expect(finished.form).toBe('wine');
    expect(finished.processes.fermenting).toBe(false);
  });

  it('finishes normal raw materials from every catalogue grape in a few weeks at a comfortable temperature', () => {
    for (const grapeId of Object.keys(GRAPES) as GrapeId[]) {
      let lot = configure(must(grapeId));
      let weeks = 0;
      while (lot.processes.fermenting && weeks < 20) {
        lot = developLot(lot, environment(), 7).lot;
        weeks += 1;
      }
      expect(lot.form, grapeId).toBe('wine');
      expect(weeks, grapeId).toBeLessThan(20);
      expect(lot.physical.sugarGPerL, grapeId).toBe(MIN_FERMENTABLE_SUGAR_G_PER_L);
      expectBounded(lot);
    }
  });

  it('moves a finite reservoir only with skin contact and responds to temperature and alcohol', () => {
    const source = must();
    const noSkins = { ...source, processes: { ...source.processes, skinContact: false } };
    const noExtraction = developLot(noSkins, environment(), 60).lot;
    const contact = developLot(source, environment(), 60).lot;
    expect(noExtraction.physical.phenolics).toBe(source.physical.phenolics);
    expect(noExtraction.physical.remainingPhenolics).toBe(source.physical.remainingPhenolics);
    expect(contact.physical.phenolics).toBeGreaterThan(source.physical.phenolics);
    expect(contact.physical.remainingPhenolics).toBeLessThan(source.physical.remainingPhenolics);
    expect(contact.physical.phenolics + contact.physical.remainingPhenolics)
      .toBeCloseTo(source.physical.phenolics + source.physical.remainingPhenolics, 12);
    expect(contact.physical.phenolics).toBeLessThanOrEqual(source.anchors.phenolics);

    const cold = developLot(source, environment({ temperatureC: 10 }), 7).lot;
    const warm = developLot(source, environment({ temperatureC: 25 }), 7).lot;
    const alcoholic = developLot(withPhysical(source, { alcoholPct: 12 }), environment(), 7).lot;
    const noAlcohol = developLot(source, environment(), 7).lot;
    expect(warm.physical.phenolics).toBeGreaterThan(cold.physical.phenolics);
    expect(alcoholic.physical.phenolics).toBeGreaterThan(noAlcohol.physical.phenolics);

    const tinyReservoir = withPhysical(source, { phenolics: source.anchors.phenolics * 0.8, remainingPhenolics: Number.EPSILON / 4 });
    const tinyResult = developLot(tinyReservoir, environment(), 1).lot;
    expect(tinyResult.physical.phenolics).toBe(tinyReservoir.physical.phenolics);
    expect(tinyResult.physical.remainingPhenolics).toBe(tinyReservoir.physical.remainingPhenolics);
    expectBounded(contact);
  });

  it('never ferments or extracts whole grapes or bottles, and does not convert inactive must', () => {
    const grapes = harvest();
    const defensiveGrapes = { ...grapes, processes: { ...grapes.processes, fermenting: true, skinContact: true } };
    const afterGrapes = developLot(defensiveGrapes, environment(), 7).lot;
    for (const key of ['sugarGPerL', 'alcoholPct', 'yeastActivity', 'phenolics', 'remainingPhenolics'] as const) {
      expect(afterGrapes.physical[key]).toBe(defensiveGrapes.physical[key]);
    }

    const dryWine = {
      ...withPhysical(must(), { sugarGPerL: 4, alcoholPct: 11, ageDays: 40 }),
      form: 'wine' as const,
      processes: { ...must().processes, fermenting: false, skinContact: false },
    };
    const bottled = bottleLot(dryWine, 'bottled-development', 2, { week: 2, structure: 0.6, taste: 0.7, quality: 0.65 });
    if (!bottled.ok) throw new Error(bottled.reason);
    const afterBottle = developLot(bottled.value, environment(), 7).lot;
    expect(afterBottle.physical.sugarGPerL).toBe(bottled.value.physical.sugarGPerL);
    expect(afterBottle.physical.alcoholPct).toBe(bottled.value.physical.alcoholPct);
    expect(afterBottle.physical.phenolics).toBe(bottled.value.physical.phenolics);
    expect(afterBottle.physical.remainingPhenolics).toBe(bottled.value.physical.remainingPhenolics);
    expect(afterBottle.processes.fermenting).toBe(false);
    expect(afterBottle.bottling).toEqual(bottled.value.bottling);
    expect(afterBottle.physical.ageDays).toBe(47);
    expect(afterBottle.physical.maturation).toBeGreaterThan(bottled.value.physical.maturation);

    // Defensive boundary: even contradictory process flags cannot make bottle material react.
    const guardedBottle = {
      ...withPhysical(bottled.value, { sugarGPerL: 80 }),
      processes: { ...bottled.value.processes, fermenting: true, skinContact: true },
    };
    const afterGuardedBottle = developLot(guardedBottle, environment(), 7).lot;
    for (const key of ['sugarGPerL', 'alcoholPct', 'yeastActivity', 'phenolics', 'remainingPhenolics'] as const) {
      expect(afterGuardedBottle.physical[key]).toBe(guardedBottle.physical[key]);
    }

    const inactive = must('pinot-noir', false);
    const afterInactive = developLot(inactive, environment(), 7).lot;
    expect(afterInactive.physical.sugarGPerL).toBe(inactive.physical.sugarGPerL);
    expect(afterInactive.physical.alcoholPct).toBe(inactive.physical.alcoholPct);
    expect(afterInactive.physical.yeastActivity).toBe(inactive.physical.yeastActivity);
  });

  it.each([2, 40])('stalls at an actual %i C even when the selected setpoint matches, then restarts explicitly', temperatureC => {
    const source = configure(must(), temperatureC);
    expect(developLot(source, environment(), 1).lot.physical.sugarGPerL).toBeLessThan(source.physical.sugarGPerL);
    const stalled = developLot(source, environment({ temperatureC }), 7).lot;
    expect(stalled.physical.sugarGPerL).toBe(source.physical.sugarGPerL);
    expect(stalled.physical.alcoholPct).toBe(source.physical.alcoholPct);
    expect(stalled.physical.yeastActivity).toBeLessThan(STUCK_FERMENTATION_YEAST_ACTIVITY_THRESHOLD);
    expect(diagnoseWine(stalled).some(fault => fault.code === 'stuck-fermentation')).toBe(true);

    const comfortable = developLot(stalled, environment(), 7).lot;
    expect(comfortable.physical.sugarGPerL).toBe(stalled.physical.sugarGPerL);
    expect(comfortable.physical.yeastActivity).toBe(stalled.physical.yeastActivity);
    const restarted = configure(comfortable, 20);
    expect(developLot(restarted, environment(), 7).lot.physical.sugarGPerL).toBeLessThan(restarted.physical.sugarGPerL);
  });

  it('stalls under alcohol stress while retaining unconverted sugar', () => {
    const source = withPhysical(configure(must()), { alcoholPct: 20, yeastActivity: 0.5 });
    const result = developLot(source, environment(), 7).lot;
    expect(result.physical.sugarGPerL).toBe(source.physical.sugarGPerL);
    expect(result.physical.alcoholPct).toBe(source.physical.alcoholPct);
    expect(result.physical.yeastActivity).toBeLessThan(source.physical.yeastActivity);
    expect(result.processes.fermenting).toBe(true);
  });

  it('passes transformed material to real maturation and risks before incrementing age', () => {
    const source = withPhysical(configure(must()), { sugarGPerL: 5, alcoholPct: 4.99, yeastActivity: 1 });
    const climate = environment({ oxygenIngress: 0.02, oakStrength: 0.9, contaminationRisk: 0.8 });
    const result = developLot(source, climate, 1).lot;
    const transformed: PhysicalLot = {
      ...source,
      form: result.form,
      processes: result.processes,
      physical: {
        ...source.physical,
        sugarGPerL: result.physical.sugarGPerL,
        alcoholPct: result.physical.alcoholPct,
        yeastActivity: result.physical.yeastActivity,
        phenolics: result.physical.phenolics,
        remainingPhenolics: result.physical.remainingPhenolics,
      },
    };
    const matured = advanceMaturation(transformed, climate, 1);
    const risked = advanceRisks({ ...transformed, physical: matured }, climate, 1);
    expect(result.physical).toEqual({ ...risked, ageDays: source.physical.ageDays + 1 });
    expect(result.form).toBe('wine');
    expect(result.physical.maturation).toBeGreaterThan(source.physical.maturation);
    expect(result.physical.oxygenExposure).toBeGreaterThan(source.physical.oxygenExposure);
  });

  it('matches seven daily calls to one seven-day call and exhibits path dependence', () => {
    const source = configure(must());
    const climate = environment();
    const whole = developLot(source, climate, 7).lot;
    let daily = source;
    for (let day = 0; day < 7; day += 1) daily = developLot(daily, climate, 1).lot;
    expect(daily).toEqual(whole);

    const first = developLot(source, climate, 3).lot;
    const colder = developLot(first, environment({ temperatureC: 10 }), 4).lot;
    const noSkins = { ...first, processes: { ...first.processes, skinContact: false } };
    const stoppedContact = developLot(noSkins, climate, 4).lot;
    expect(colder.physical.sugarGPerL).toBeGreaterThan(whole.physical.sugarGPerL);
    expect(stoppedContact.physical.phenolics).toBeLessThan(whole.physical.phenolics);
    expectBounded(colder);
    expectBounded(stoppedContact);
  });

  it('validates inputs and refuses arithmetic that would overflow or silently lose advancement', () => {
    const source = configure(must());
    expect(developLot(source, environment(), 0)).toEqual({ lot: source, causes: [] });
    for (const days of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => developLot(source, environment(), days)).toThrow();
    }
    expect(() => developLot(withPhysical(source, { sugarGPerL: Number.NaN }), environment(), 1)).toThrow();
    expect(() => developLot(withPhysical(source, { sugarGPerL: source.anchors.sugarGPerL + 1 }), environment(), 1)).toThrow();
    expect(() => developLot(withPhysical(source, { yeastActivity: 1.1 }), environment(), 1)).toThrow();
    expect(() => developLot(withPhysical(source, { ageDays: Number.MAX_SAFE_INTEGER }), environment(), 1)).toThrow();
    expect(() => developLot(withPhysical(source, { oxygenExposure: Number.MAX_VALUE }), environment(), 1)).toThrow();
    expect(() => developLot(withPhysical({ ...source, form: 'wine' }, { maturation: Number.MAX_VALUE }), environment(), 1)).toThrow();
    expect(() => developLot(source, environment({ temperatureC: Number.NaN }), 1)).toThrow();
    expect(() => developLot(source, environment({ oakStrength: 1.01 }), 1)).toThrow();
    expect(() => developLot(source, environment({ contaminationRisk: -0.1 }), 1)).toThrow();
    expect(() => developLot(source, environment({ oxygenIngress: Number.POSITIVE_INFINITY }), 1)).toThrow();
  });
});
