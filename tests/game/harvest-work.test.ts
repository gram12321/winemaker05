import { describe, expect, it } from 'vitest';
import { progressHarvestWork } from '../../src/game/work/Rules';
import type { WorkState } from '../../src/game/work/types';
import type { Vineyard } from '../../src/game/vineyard/types';

const weather = { temperatureC: 20, rainMm: 0, humidity: 0.5 };
const vineyard = (id: string): Vineyard => ({ id, name: id, siteId: 'hillside', grapeId: 'pinot-noir', areaHa: 1, plantedYear: 1, cropYear: 1, ripeness: 1, condition: 1, cropKg: 500, harvestedKg: 0, lostKg: 0, ripeKg: 500, rot: 0, nobleRot: 0 });
const work: WorkState = {
  staff: [{ id: 'worker-a', name: 'A', kgPerWeek: 100, experience: 0 }, { id: 'worker-b', name: 'B', kgPerWeek: 100, experience: 0 }],
  activities: [
    { id: 'harvest-b', vineyardId: 'vineyard-b', targetKg: 300, completedKg: 0, staffIds: ['worker-a', 'worker-b'], priority: 2, blockedReason: null },
    { id: 'harvest-a', vineyardId: 'vineyard-a', targetKg: 300, completedKg: 0, staffIds: ['worker-a', 'worker-b'], priority: 1, blockedReason: null },
  ],
};
const vineyards = [vineyard('vineyard-a'), vineyard('vineyard-b')];

describe('feasible harvest work and attribution', () => {
  it('splits staff evenly and allocates contested storage in stable priority order', () => {
    const before = structuredClone(work);
    const result = progressHarvestWork(work, vineyards, weather, 120, false);
    expect(result.outputs).toEqual([{ vineyardId: 'vineyard-a', activityId: 'harvest-a', kilograms: 100 }, { vineyardId: 'vineyard-b', activityId: 'harvest-b', kilograms: 20 }]);
    expect(result.work.staff.map(worker => worker.experience)).toEqual([60, 60]);
    expect(progressHarvestWork({ ...work, activities: [...work.activities].reverse() }, vineyards, weather, 120, false)).toEqual(result);
    expect(work).toEqual(before);
  });

  it('shares productive tasks evenly when crop and storage are available', () => {
    const result = progressHarvestWork(work, vineyards, weather, 500, false);
    expect(result.outputs).toEqual([
      { vineyardId: 'vineyard-a', activityId: 'harvest-a', kilograms: 100 },
      { vineyardId: 'vineyard-b', activityId: 'harvest-b', kilograms: 100 },
    ]);
    expect(result.work.staff.map(worker => worker.experience)).toEqual([100, 100]);
  });

  it('redistributes capacity after a small target is completed', () => {
    const activities = [
      { id: 'harvest-small', vineyardId: 'vineyard-a', targetKg: 1, completedKg: 0, staffIds: ['worker-a', 'worker-b'], priority: 1, blockedReason: null },
      { id: 'harvest-large', vineyardId: 'vineyard-b', targetKg: 500, completedKg: 0, staffIds: ['worker-a', 'worker-b'], priority: 2, blockedReason: null },
    ];
    const result = progressHarvestWork({ ...work, activities }, vineyards, weather, 500, false);
    expect(result.outputs).toEqual([
      { vineyardId: 'vineyard-a', activityId: 'harvest-small', kilograms: 1 },
      { vineyardId: 'vineyard-b', activityId: 'harvest-large', kilograms: 199 },
    ]);
    expect(result.work.staff.map(worker => worker.experience)).toEqual([100, 100]);
    expect(result.work.activities).toEqual([{ ...activities[1], completedKg: 199 }]);
  });

  it('does not assign staff capacity to a task waiting for more ripe grapes', () => {
    const result = progressHarvestWork(work, [{ ...vineyards[0], ripeKg: 0 }, vineyards[1]], weather, 500, false);
    expect(result.outputs).toEqual([{ vineyardId: 'vineyard-b', activityId: 'harvest-b', kilograms: 200 }]);
    expect(result.work.staff.map(worker => worker.experience)).toEqual([100, 100]);
    expect(result.work.activities.find(activity => activity.id === 'harvest-a')?.blockedReason).toContain('ripen');
  });

  it('keeps separate workers available to their disjoint assignments', () => {
    const disjoint: WorkState = {
      staff: work.staff,
      activities: [
        { id: 'harvest-a-only', vineyardId: 'vineyard-a', targetKg: 300, completedKg: 0, staffIds: ['worker-a'], priority: 1, blockedReason: null },
        { id: 'harvest-b-only', vineyardId: 'vineyard-b', targetKg: 300, completedKg: 0, staffIds: ['worker-b'], priority: 2, blockedReason: null },
      ],
    };
    const result = progressHarvestWork(disjoint, vineyards, weather, 500, false);
    expect(result.outputs.map(output => output.kilograms)).toEqual([100, 100]);
    expect(result.work.staff.map(worker => worker.experience)).toEqual([100, 100]);
  });

  it('uses ID order for equal-priority storage claims regardless of input order', () => {
    const tied: WorkState = {
      staff: work.staff,
      activities: [
        { id: 'z-harvest', vineyardId: 'vineyard-b', targetKg: 300, completedKg: 0, staffIds: ['worker-b'], priority: 1, blockedReason: null },
        { id: 'a-harvest', vineyardId: 'vineyard-a', targetKg: 300, completedKg: 0, staffIds: ['worker-a'], priority: 1, blockedReason: null },
      ],
    };
    const result = progressHarvestWork(tied, vineyards, weather, 100, false);
    expect(result.outputs).toEqual([{ vineyardId: 'vineyard-a', activityId: 'a-harvest', kilograms: 100 }]);
    expect(progressHarvestWork({ ...tied, activities: [...tied.activities].reverse() }, vineyards, weather, 100, false)).toEqual(result);
  });

  it('does not harvest the same ripe crop twice across activities', () => {
    const competing: WorkState = {
      staff: work.staff,
      activities: [
        { id: 'first-claim', vineyardId: 'vineyard-a', targetKg: 300, completedKg: 0, staffIds: ['worker-a'], priority: 1, blockedReason: null },
        { id: 'second-claim', vineyardId: 'vineyard-a', targetKg: 300, completedKg: 0, staffIds: ['worker-b'], priority: 2, blockedReason: null },
      ],
    };
    const result = progressHarvestWork(competing, [{ ...vineyards[0], ripeKg: 100 }], weather, 500, false);
    expect(result.outputs).toEqual([{ vineyardId: 'vineyard-a', activityId: 'first-claim', kilograms: 100 }]);
    expect(result.outputs.reduce((sum, output) => sum + output.kilograms, 0)).toBe(100);
  });

  it('conserves baseline staff capacity across weather and condition factors', () => {
    const shared: WorkState = {
      staff: [{ id: 'worker', name: 'Worker', kgPerWeek: 100, experience: 0 }],
      activities: [
        { id: 'lower-condition', vineyardId: 'vineyard-a', targetKg: 300, completedKg: 0, staffIds: ['worker'], priority: 1, blockedReason: null },
        { id: 'full-condition', vineyardId: 'vineyard-b', targetKg: 300, completedKg: 0, staffIds: ['worker'], priority: 2, blockedReason: null },
      ],
    };
    const conditionVineyards = [
      { ...vineyards[0], condition: 0.5 },
      { ...vineyards[1], condition: 1 },
    ];
    const rainy = { ...weather, rainMm: 10 };
    const result = progressHarvestWork(shared, conditionVineyards, rainy, 500, false);
    expect(result.outputs.map(output => output.kilograms)).toEqual([33.75, 45]);
    const baselineCapacityUsed = result.outputs.reduce((sum, output, index) => {
      const factor = index === 0 ? 0.9 * 0.75 : 0.9;
      return sum + output.kilograms / factor;
    }, 0);
    expect(baselineCapacityUsed).toBeCloseTo(100);
    expect(result.work.staff[0].experience).toBeCloseTo(78.75);
  });

  it('awards work and experience only for currently harvestable material', () => {
    const single = { ...work, activities: [work.activities[1]] };
    const result = progressHarvestWork(single, [{ ...vineyards[0], ripeKg: 30 }], weather, 500, false);
    expect(result.outputs[0].kilograms).toBe(30);
    expect(result.work.activities[0].completedKg).toBe(30);
    expect(result.work.staff.reduce((sum, worker) => sum + worker.experience, 0)).toBe(30);
    const blocked = progressHarvestWork(single, [{ ...vineyards[0], ripeKg: 0 }], weather, 500, false);
    expect(blocked.outputs).toEqual([]);
    expect(blocked.work.activities[0].blockedReason).toContain('ripen');
  });

  it('finishes after the last standing gram even when crop loss prevents the original target', () => {
    const single = { ...work, activities: [work.activities[1]] };
    const damaged = { ...vineyards[0], cropKg: 500, harvestedKg: 200, lostKg: 299.999, ripeKg: 0.001 };
    const result = progressHarvestWork(single, [damaged], weather, 500, false);
    expect(result.outputs).toEqual([{ vineyardId: damaged.id, activityId: 'harvest-a', kilograms: 0.001 }]);
    expect(result.work.activities).toEqual([]);
    expect(result.work.staff.reduce((sum, worker) => sum + worker.experience, 0)).toBe(0.001);
  });

  it('allocates the final gram when two activities share ripe fruit and storage', () => {
    const shared = { ...vineyards[0], cropKg: 1.001, ripeKg: 1.001 };
    const split: WorkState = {
      staff: [{ id: 'worker-a', name: 'A', kgPerWeek: 1, experience: 0 }, { id: 'worker-b', name: 'B', kgPerWeek: 0.001, experience: 0 }],
      activities: [
        { id: 'first', vineyardId: shared.id, targetKg: 1.001, completedKg: 0, staffIds: ['worker-a'], priority: 1, blockedReason: null },
        { id: 'second', vineyardId: shared.id, targetKg: 1.001, completedKg: 0, staffIds: ['worker-b'], priority: 2, blockedReason: null },
      ],
    };
    const result = progressHarvestWork(split, [shared], weather, 1.001, false);
    expect(result.outputs.map(output => output.kilograms)).toEqual([1, 0.001]);
    expect(result.work.activities).toEqual([]);
    expect(result.work.staff.reduce((sum, worker) => sum + worker.experience, 0)).toBeCloseTo(1.001, 6);
  });

  it.each([
    { storage: 0, rain: 0, arrears: false, reason: 'storage' },
    { storage: 500, rain: 90, arrears: false, reason: 'rain' },
    { storage: 500, rain: 0, arrears: true, reason: 'wages' },
  ])('keeps blocked work from producing material or XP: $reason', ({ storage, rain, arrears, reason }) => {
    const result = progressHarvestWork(work, vineyards, { ...weather, rainMm: rain }, storage, arrears);
    expect(result.outputs).toEqual([]);
    expect(result.work.staff.map(worker => worker.experience)).toEqual([0, 0]);
    expect(result.work.activities[0].blockedReason?.toLowerCase()).toContain(reason);
  });
});
