import { describe, expect, it } from 'vitest';
import {
  BOTTLE_DAILY_OXYGEN_INGRESS,
  MAX_VESSEL_CAPACITY_LITRES,
  MIN_USABLE_VESSEL_CONDITION,
  VESSEL_CONDITION_LOSS_PER_OCCUPIED_WEEK,
  VESSEL_MATERIALS,
  ageVessels,
  isUsableVessel,
  maintainVessel,
  recordVesselFill,
  resolveWineEnvironment,
  vesselCapacityFreeMl,
  vesselPurchase,
} from '../../src/game/equipment/Rules';
import type { Vessel } from '../../src/game/equipment/types';
import { deriveStructure } from '../../src/game/evaluation/Sensory';
import { deriveTaste } from '../../src/game/evaluation/Taste';
import type { Holding } from '../../src/game/inventory/types';
import {
  MATURITY_WINDOW_END,
  MATURITY_WINDOW_START,
  advanceMaturation,
  maturityOutlook,
} from '../../src/game/wine/Maturation';
import { bottleLot } from '../../src/game/wine/Operations';
import { advanceRisks } from '../../src/game/wine/Risks';
import type { PhysicalLot, PhysicalState, WineEnvironment } from '../../src/game/wine/types';

function wine(physical: Partial<PhysicalState> = {}): PhysicalLot {
  const anchors = { sugarGPerL: 220, acidity: 0.7, phenolics: 0.6, aromatics: 0.8, body: 0.65, agingPotential: 0.65 };
  const origin = {
    vineyardId: 'vineyard', vineyardName: 'Vineyard', region: 'Valley', siteId: 'hillside' as const,
    grapeId: 'pinot-noir' as const, vintage: 2030, terroirPotential: 0.7, originPrestige: 0.5,
  };
  return {
    id: 'lot-1', wineId: 'wine-1', name: 'Test wine', form: 'wine', origin, anchors,
    physical: {
      sugarGPerL: 2, alcoholPct: 12, acidity: 0.7, phenolics: 0.3, remainingPhenolics: 0.2,
      aroma: 0.42, yeastActivity: 0.3, oxygenExposure: 0.05, oxidation: 0.02, maturation: 0,
      oak: 0, lees: 0, greenCharacter: 0.1, rot: 0.02, ageDays: 21, ...physical,
    },
    processes: { fermenting: false, skinContact: false, temperatureC: 21, leesContact: false },
    parentIds: [], sources: [{ origin, anchors, fraction: 1 }], history: [], bottling: null,
  };
}

function vessel(overrides: Partial<Vessel> = {}): Vessel {
  return { id: 'vessel-1', name: 'Test vessel', material: 'oak', capacityMl: 200_000, condition: 1, uses: 1, ...overrides };
}

function holding(overrides: Partial<Holding> = {}): Holding {
  return { lotId: 'lot-1', quantity: 200_000, unit: 'ml', location: 'vessel', vesselId: 'vessel-1', ...overrides };
}

function climate(overrides: Partial<WineEnvironment> = {}): WineEnvironment {
  return { temperatureC: 15, oxygenIngress: 0, oakStrength: 0, contaminationRisk: 0, ...overrides };
}

describe('vessels and wine environment', () => {
  it('validates purchases and returns priced, unused vessels in millilitres', () => {
    const steel = vesselPurchase({ id: 'steel-1', material: 'steel', capacityLitres: 200 });
    const oak = vesselPurchase({ id: 'oak-1', material: 'oak', capacityLitres: 200 });
    expect(steel.ok).toBe(true);
    expect(oak.ok).toBe(true);
    if (!steel.ok || !oak.ok) throw new Error('Expected valid purchase.');
    expect(steel.value.vessel).toMatchObject({ id: 'steel-1', material: 'steel', capacityMl: 200_000, condition: 1, uses: 0 });
    expect(oak.value.costCents).toBeGreaterThan(steel.value.costCents);
    for (const capacityLitres of [0, -1, 1.1, NaN, Infinity, MAX_VESSEL_CAPACITY_LITRES + 1]) {
      expect(vesselPurchase({ id: 'v', material: 'oak', capacityLitres }).ok).toBe(false);
    }
    expect(vesselPurchase({ id: ' ', material: 'oak', capacityLitres: 1 }).ok).toBe(false);
    expect(vesselPurchase({ id: 'v', material: 'toString' as Vessel['material'], capacityLitres: 1 }).ok).toBe(false);
  });

  it('derives physical free space and excludes only explicitly consumed blend inputs', () => {
    const storage = vessel();
    const inventory = [holding({ quantity: 100_000 }), holding({ lotId: 'lot-2', quantity: 60_000 }),
      holding({ lotId: 'other', vesselId: 'other-vessel', quantity: 50_000 })];
    expect(vesselCapacityFreeMl(storage, inventory)).toBe(40_000);
    expect(vesselCapacityFreeMl(storage, inventory, ['lot-1'])).toBe(140_000);
    expect(vesselCapacityFreeMl(storage, inventory, ['lot-1', 'lot-2'])).toBe(200_000);
    expect(vesselCapacityFreeMl(storage, [...inventory, holding({ lotId: 'over', quantity: 100_000 })])).toBe(0);
  });

  it('wears filled vessels once per week, preserves fill history through maintenance, and rejects exhausted counts', () => {
    const original = vessel({ condition: 0.5, uses: 3 });
    const untouched = vessel({ id: 'empty' });
    const before = structuredClone([original, untouched]);
    const aged = ageVessels([original, untouched], [holding(), holding({ lotId: 'second' })]);
    expect(aged[0].condition).toBeCloseTo(0.5 - VESSEL_CONDITION_LOSS_PER_OCCUPIED_WEEK);
    expect(aged[1]).toEqual(untouched);
    expect([original, untouched]).toEqual(before);
    expect(isUsableVessel({ ...original, condition: MIN_USABLE_VESSEL_CONDITION })).toBe(true);
    expect(isUsableVessel({ ...original, condition: MIN_USABLE_VESSEL_CONDITION - 0.001 })).toBe(false);
    const maintained = maintainVessel(aged[0]);
    expect(maintained.costCents).toBeGreaterThan(0);
    expect(maintained.vessel).toEqual({ ...original, condition: 1 });
    const filled = recordVesselFill(maintained.vessel);
    expect(filled.ok && filled.value.uses).toBe(4);
    expect(recordVesselFill({ ...original, uses: Number.MAX_SAFE_INTEGER }).ok).toBe(false);
  });

  it('maps material, headspace, condition and prior fills to causal exposure without mutation', () => {
    const lot = wine();
    const allocation = holding();
    const freshOak = vessel();
    const snapshot = structuredClone({ lot, allocation, freshOak });
    const steel = resolveWineEnvironment(lot, allocation, vessel({ material: 'steel' }), 14);
    const oak = resolveWineEnvironment(lot, allocation, freshOak, 14);
    const concrete = resolveWineEnvironment(lot, allocation, vessel({ material: 'concrete' }), 14);
    expect(steel.oxygenIngress).toBe(VESSEL_MATERIALS.steel.dailyOxygenIngress);
    expect(oak.oxygenIngress).toBe(VESSEL_MATERIALS.oak.dailyOxygenIngress);
    expect(concrete.oxygenIngress).toBe(VESSEL_MATERIALS.concrete.dailyOxygenIngress);
    expect(oak.oakStrength).toBeGreaterThan(0);
    expect(steel.oakStrength).toBe(0);
    expect(concrete.oakStrength).toBe(0);

    const half = resolveWineEnvironment(lot, allocation, freshOak, 14, 100_000);
    const worn = resolveWineEnvironment(lot, allocation, vessel({ condition: 0.4 }), 14);
    const reused = resolveWineEnvironment(lot, allocation, vessel({ uses: 4 }), 14);
    expect(half.oxygenIngress).toBeGreaterThan(oak.oxygenIngress);
    expect(half.contaminationRisk).toBeGreaterThan(oak.contaminationRisk);
    expect(half.oakStrength).not.toBe(oak.oakStrength);
    expect(worn.oxygenIngress).toBeGreaterThan(oak.oxygenIngress);
    expect(worn.contaminationRisk).toBeGreaterThan(oak.contaminationRisk);
    expect(worn.oakStrength).toBeLessThan(oak.oakStrength);
    expect(reused.oakStrength).toBeLessThan(oak.oakStrength);
    expect(reused.contaminationRisk).toBeGreaterThan(oak.contaminationRisk);
    expect({ lot, allocation, freshOak }).toEqual(snapshot);
  });

  it('uses controlled Celsius during fermentation and cellar Celsius for resting wine and bottles', () => {
    const lot = wine();
    const fermenting = { ...lot, form: 'must' as const, processes: { ...lot.processes, fermenting: true, temperatureC: 23 } };
    expect(resolveWineEnvironment(fermenting, holding(), vessel(), 11).temperatureC).toBe(23);
    expect(resolveWineEnvironment(lot, holding(), vessel(), 11).temperatureC).toBe(11);
    const bottled = { ...lot, form: 'bottled' as const };
    const bottles = holding({ quantity: 100, unit: 'bottle', location: 'cellar', vesselId: null });
    const cool = resolveWineEnvironment(bottled, bottles, null, 11);
    const warm = resolveWineEnvironment(bottled, bottles, null, 21);
    expect(cool).toMatchObject({ temperatureC: 11, oxygenIngress: BOTTLE_DAILY_OXYGEN_INGRESS, oakStrength: 0 });
    expect(cool.oxygenIngress).toBeLessThan(VESSEL_MATERIALS.steel.dailyOxygenIngress);
    expect(warm.temperatureC).toBe(21);
    const grapes = { ...lot, form: 'grapes' as const };
    const receiving = resolveWineEnvironment(grapes, holding({ unit: 'g', location: 'harvest', vesselId: null }), null, 11);
    expect(receiving.temperatureC).toBeGreaterThanOrEqual(10);
    expect(receiving.temperatureC).toBeLessThanOrEqual(25);
    expect(() => resolveWineEnvironment(lot, holding(), null, 11)).toThrow(/allocated vessel/);
  });
});

describe('continuous wine maturation', () => {
  it('uses canonical daily steps, preserves input and changes only owned physical fields', () => {
    const lot = { ...wine({ maturation: 0.2 }), processes: { ...wine().processes, leesContact: true } };
    const snapshot = structuredClone(lot);
    const environment = climate({ oakStrength: 0.7, temperatureC: 18 });
    const full = advanceMaturation(lot, environment, 100);
    const first = advanceMaturation(lot, environment, 37);
    const partitioned = advanceMaturation({ ...lot, physical: first }, environment, 63);
    expect(partitioned).toEqual(full);
    expect(advanceMaturation(lot, environment, 100)).toEqual(full);
    expect(lot).toEqual(snapshot);
    for (const field of ['sugarGPerL', 'alcoholPct', 'phenolics', 'remainingPhenolics', 'yeastActivity',
      'oxygenExposure', 'oxidation', 'greenCharacter', 'rot', 'ageDays'] as const) {
      expect(full[field]).toBe(snapshot.physical[field]);
    }
    expect(full.oak).toBeGreaterThan(0);
    expect(full.lees).toBeGreaterThan(0);
    expect(full.acidity).toBeLessThan(lot.physical.acidity);
    expect(() => advanceMaturation(lot, environment, -1)).toThrow(/days/);
    expect(() => advanceMaturation({ ...lot, physical: { ...lot.physical, maturation: Number.MAX_VALUE } }, environment, 1)).toThrow(/numeric range/);
  });

  it('progresses through early integration and softening, a maturity window, and aromatic decline', () => {
    const lot = wine();
    const early = advanceMaturation(lot, climate(), 250);
    const inWindow = { ...lot, physical: early };
    const late = advanceMaturation(lot, climate(), 1600);
    expect(maturityOutlook(lot).label).toBe('Developing');
    expect(maturityOutlook(inWindow).label).toBe('In maturity window');
    expect(maturityOutlook({ ...lot, physical: late }).label).toBe('Declining');
    expect(early.acidity).toBeLessThan(lot.physical.acidity);
    expect(early.aroma).toBeGreaterThan(lot.physical.aroma);
    expect(early.aroma).toBeLessThanOrEqual(lot.anchors.aromatics);
    expect(late.aroma).toBeLessThan(early.aroma);
    expect(late.maturation).toBeGreaterThan(1);
    expect(maturityOutlook({ ...lot, physical: { ...lot.physical, maturation: MATURITY_WINDOW_START } }).label).toBe('In maturity window');
    expect(maturityOutlook({ ...lot, physical: { ...lot.physical, maturation: MATURITY_WINDOW_END } }).label).toBe('In maturity window');
    expect(maturityOutlook({ ...lot, physical: { ...lot.physical, maturation: MATURITY_WINDOW_END + 0.001 } }).label).toBe('Declining');
    expect(maturityOutlook({ ...lot, physical: late }).progress).toBe(1);
  });

  it('changes sensory expression even when the inherited aromatic capacity starts fully expressed', () => {
    const initial = wine({ aroma: 0.8 });
    const early = { ...initial, physical: advanceMaturation(initial, climate(), 250) };
    const late = { ...initial, physical: advanceMaturation(initial, climate(), 1600) };
    expect(early.physical.aroma).toBe(initial.anchors.aromatics);
    expect(deriveTaste(early).families.aged).toBeGreaterThan(deriveTaste(initial).families.aged);
    expect(deriveStructure(early).acidity).toBeLessThan(deriveStructure(initial).acidity);
    expect(deriveStructure(late).aroma).toBeLessThan(deriveStructure(early).aroma);
  });

  it('uses temperature, inherited aging potential, oak, lees and previous oxidation as distinct inputs', () => {
    const lot = wine();
    const cool = advanceMaturation(lot, climate({ temperatureC: 8 }), 200);
    const warm = advanceMaturation(lot, climate({ temperatureC: 24 }), 200);
    const durable = { ...lot, anchors: { ...lot.anchors, agingPotential: 1 } };
    const shortLived = { ...lot, anchors: { ...lot.anchors, agingPotential: 0 } };
    expect(warm.maturation).toBeGreaterThan(cool.maturation);
    expect(advanceMaturation(shortLived, climate(), 200).maturation).toBeGreaterThan(advanceMaturation(durable, climate(), 200).maturation);
    const oak = advanceMaturation(lot, climate({ oakStrength: 1 }), 200);
    const noOak = advanceMaturation(lot, climate(), 200);
    const withLees = advanceMaturation({ ...lot, processes: { ...lot.processes, leesContact: true } }, climate(), 200);
    expect(oak.oak).toBeGreaterThan(noOak.oak);
    expect(withLees.lees).toBeGreaterThan(noOak.lees);
    const oxidized = { ...lot, physical: { ...lot.physical, oxidation: 0.7 } };
    expect(advanceMaturation(oxidized, climate(), 250).aroma).toBeLessThan(advanceMaturation(lot, climate(), 250).aroma);
    const fullAroma = { ...lot, physical: { ...lot.physical, aroma: lot.anchors.aromatics } };
    expect(advanceMaturation(fullAroma, climate(), 250).aroma).toBeLessThanOrEqual(lot.anchors.aromatics);
  });

  it('carries real vessel and bottle differences through to physical development', () => {
    const lot = wine();
    const allocation = holding();
    const fresh = resolveWineEnvironment(lot, allocation, vessel(), 15);
    const used = resolveWineEnvironment(lot, allocation, vessel({ uses: 5 }), 15);
    const steel = resolveWineEnvironment(lot, allocation, vessel({ material: 'steel' }), 15);
    const underfilled = resolveWineEnvironment(lot, allocation, vessel(), 15, 50_000);
    const worn = resolveWineEnvironment(lot, allocation, vessel({ condition: 0.3 }), 15);
    expect(advanceMaturation(lot, fresh, 180).oak).toBeGreaterThan(advanceMaturation(lot, used, 180).oak);
    expect(advanceMaturation(lot, used, 180).oak).toBeGreaterThan(advanceMaturation(lot, steel, 180).oak);
    expect(advanceRisks(lot, underfilled, 180).oxidation).toBeGreaterThan(advanceRisks(lot, fresh, 180).oxidation);
    expect(advanceRisks(lot, worn, 180).oxidation).toBeGreaterThan(advanceRisks(lot, fresh, 180).oxidation);

    const bottled = { ...lot, form: 'bottled' as const, bottling: { week: 1, structure: 0.7, taste: 0.7, quality: 0.7 } };
    const bottles = holding({ quantity: 100, unit: 'bottle', location: 'cellar', vesselId: null });
    const coldBottle = resolveWineEnvironment(bottled, bottles, null, 8);
    const warmBottle = resolveWineEnvironment(bottled, bottles, null, 24);
    expect(advanceMaturation(bottled, warmBottle, 180).maturation).toBeGreaterThan(advanceMaturation(bottled, coldBottle, 180).maturation);
    expect(advanceRisks(bottled, coldBottle, 180).oxidation).toBeLessThan(advanceRisks(lot, fresh, 180).oxidation);
  });

  it('does not mature grapes or unfermented must; lees can act after fermentation starts', () => {
    const lot = wine({ alcoholPct: 0, sugarGPerL: 200 });
    const grapes = { ...lot, form: 'grapes' as const, processes: { ...lot.processes, leesContact: true } };
    const must = { ...grapes, form: 'must' as const };
    expect(advanceMaturation(grapes, climate({ oakStrength: 1 }), 100)).toEqual(grapes.physical);
    expect(advanceMaturation(must, climate({ oakStrength: 1 }), 100)).toEqual(must.physical);
    const fermenting = { ...must, physical: { ...must.physical, alcoholPct: 2 }, processes: { ...must.processes, fermenting: true } };
    const next = advanceMaturation(fermenting, climate({ oakStrength: 1 }), 100);
    expect(next.maturation).toBe(0);
    expect(next.acidity).toBe(fermenting.physical.acidity);
    expect(next.aroma).toBe(fermenting.physical.aroma);
    expect(next.lees).toBeGreaterThan(0);
    const developed = { ...fermenting, physical: { ...fermenting.physical, alcoholPct: 5 } };
    expect(advanceMaturation(developed, climate(), 1).maturation).toBeGreaterThan(0);
  });

  it('retains physical development and bottling snapshot as the same engine continues in the bottle', () => {
    const lot = wine();
    const bulkPhysical = advanceMaturation(lot, climate(), 200);
    const bulk = { ...lot, physical: bulkPhysical };
    const rawAnchors = structuredClone(bulk.anchors);
    const assessment = { week: 20, structure: 0.8, taste: 0.7, quality: 0.75 };
    const result = bottleLot(bulk, 'bottled-1', 20, assessment);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    const bottled = result.value;
    const before = structuredClone(bottled);
    expect(bottled.physical).toEqual(bulkPhysical);
    expect(advanceMaturation(bottled, climate(), 100)).toEqual(advanceMaturation(bulk, climate(), 100));
    expect(advanceMaturation(bottled, climate(), 100).maturation).toBeGreaterThan(bulkPhysical.maturation);
    expect(bottled.bottling).toEqual(assessment);
    expect(bottled.anchors).toEqual(rawAnchors);
    expect(bottled).toEqual(before);
  });
});
