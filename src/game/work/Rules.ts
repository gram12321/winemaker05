import type { HarvestActivity, WorkState } from './types';
import type { Vineyard, Weather } from '../vineyard/types';
import { clamp } from '../core/Numbers';
import { MINIMUM_HARVEST_RIPENESS } from '../vineyard/Rules';

export interface HarvestWorkOutput { readonly vineyardId: string; readonly kilograms: number; readonly activityId: string }
export interface HarvestWorkResult { readonly work: WorkState; readonly outputs: readonly HarvestWorkOutput[] }
export const HARVEST_RAIN_STOP_MM = 32;

const HARVEST_KG_PRECISION = 1_000;
const HARVEST_KG_EPSILON = 1e-7;
const MIN_HARVEST_WORK_KG = 1 / HARVEST_KG_PRECISION;

interface StaffContribution {
  readonly workerId: string;
  readonly workCapacityKg: number;
}

/** Shared by previews and execution. Productive tasks share staff time; stable priority allocates contested resources. */
export function progressHarvestWork(work: WorkState, vineyards: readonly Vineyard[], weather: Weather, freeStorageKg: number, harvestableKgById: ReadonlyMap<string, number>, wagesOverdue: boolean): HarvestWorkResult {
  const ordered = [...work.activities].sort((a, b) => a.priority - b.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const vineyardsById = new Map(vineyards.map(vineyard => [vineyard.id, vineyard]));
  const remainingStaffCapacity = new Map(work.staff.map(worker => [worker.id, Math.max(0, worker.kgPerWeek)]));
  const harvestedByActivity = new Map<string, number>();
  const harvestedByVineyard = new Map<string, number>();
  const appliedXp = new Map<string, number>();
  let storageRemaining = Math.max(0, freeStorageKg);
  const weatherFactor = clamp(1 - weather.rainMm / 100, 0.15, 1);

  const activityState = (activity: HarvestActivity) => {
    const vineyard = vineyardsById.get(activity.vineyardId);
    const harvestedHere = harvestedByVineyard.get(activity.vineyardId) ?? 0;
    const remainingCropKg = vineyard ? vineyard.cropKg - vineyard.harvestedKg - harvestedHere : 0;
    const harvestableNowKg = vineyard ? (harvestableKgById.get(vineyard.id) ?? 0) - harvestedHere : 0;
    const targetRemainingKg = activity.targetKg - activity.completedKg - (harvestedByActivity.get(activity.id) ?? 0);
    const blockedReason = !vineyard ? 'The vineyard is unavailable.'
      : wagesOverdue ? 'Harvest pauses for unpaid wages. Available cash pays arrears at the next week end.'
        : vineyard.ripeness < MINIMUM_HARVEST_RIPENESS ? 'The crop is not ready to harvest.'
          : weather.rainMm >= HARVEST_RAIN_STOP_MM ? 'Heavy rain has stopped harvest work.'
            : storageRemaining < MIN_HARVEST_WORK_KG ? 'Harvest storage is full. Press stored grapes to free space.'
              : remainingCropKg < MIN_HARVEST_WORK_KG ? 'No crop remains for this activity.'
                : harvestableNowKg < MIN_HARVEST_WORK_KG ? 'More grapes need to ripen before harvest can continue.'
                  : null;
    const availableKg = Math.max(0, Math.min(targetRemainingKg, remainingCropKg, harvestableNowKg, storageRemaining));
    const conditionFactor = vineyard ? 0.5 + vineyard.condition * 0.5 : 0;
    return { vineyard, availableKg, blockedReason, productivityFactor: weatherFactor * conditionFactor };
  };

  while (true) {
    const active = ordered.filter(activity => {
      const state = activityState(activity);
      if (state.blockedReason || state.availableKg < MIN_HARVEST_WORK_KG || state.productivityFactor <= 0) return false;
      const assignedCapacity = work.staff.reduce((sum, worker) => activity.staffIds.includes(worker.id)
        ? sum + (remainingStaffCapacity.get(worker.id) ?? 0)
        : sum, 0);
      return assignedCapacity * state.productivityFactor >= MIN_HARVEST_WORK_KG - HARVEST_KG_EPSILON;
    });
    if (active.length === 0) break;

    const assignmentCounts = new Map<string, number>();
    for (const activity of active) {
      for (const worker of work.staff) {
        if (activity.staffIds.includes(worker.id) && (remainingStaffCapacity.get(worker.id) ?? 0) > HARVEST_KG_EPSILON) {
          assignmentCounts.set(worker.id, (assignmentCounts.get(worker.id) ?? 0) + 1);
        }
      }
    }

    const contributionsByActivity = new Map<string, readonly StaffContribution[]>();
    for (const activity of active) {
      contributionsByActivity.set(activity.id, work.staff.flatMap(worker => {
        const count = assignmentCounts.get(worker.id) ?? 0;
        const remaining = remainingStaffCapacity.get(worker.id) ?? 0;
        return activity.staffIds.includes(worker.id) && count > 0 && remaining > HARVEST_KG_EPSILON
          ? [{ workerId: worker.id, workCapacityKg: remaining / count }]
          : [];
      }));
    }

    let madeProgress = false;
    for (const activity of active) {
      const state = activityState(activity);
      if (!state.vineyard || state.blockedReason || state.productivityFactor <= 0) continue;
      const contributions = contributionsByActivity.get(activity.id) ?? [];
      const totalWorkCapacity = contributions.reduce((sum, contribution) => sum + contribution.workCapacityKg, 0);
      if (totalWorkCapacity <= HARVEST_KG_EPSILON) continue;

      const kilograms = Math.floor(Math.min(state.availableKg, totalWorkCapacity * state.productivityFactor) * HARVEST_KG_PRECISION + HARVEST_KG_EPSILON) / HARVEST_KG_PRECISION;
      if (kilograms < MIN_HARVEST_WORK_KG) continue;

      const usedWorkCapacity = Math.min(totalWorkCapacity, kilograms / state.productivityFactor);
      for (const contribution of contributions) {
        const share = contribution.workCapacityKg / totalWorkCapacity;
        const workerCapacity = remainingStaffCapacity.get(contribution.workerId) ?? 0;
        const workerWorkUsed = usedWorkCapacity * share;
        remainingStaffCapacity.set(contribution.workerId, Math.max(0, workerCapacity - workerWorkUsed));
        appliedXp.set(contribution.workerId, (appliedXp.get(contribution.workerId) ?? 0) + kilograms * share);
      }

      harvestedByActivity.set(activity.id, (harvestedByActivity.get(activity.id) ?? 0) + kilograms);
      harvestedByVineyard.set(activity.vineyardId, (harvestedByVineyard.get(activity.vineyardId) ?? 0) + kilograms);
      storageRemaining = Math.max(0, storageRemaining - kilograms);
      madeProgress = true;
    }
    if (!madeProgress) break;
  }

  const activities: HarvestActivity[] = [];
  for (const activity of ordered) {
    const vineyard = vineyardsById.get(activity.vineyardId);
    const activityHarvestedKg = harvestedByActivity.get(activity.id) ?? 0;
    const completedKg = Math.round((activity.completedKg + activityHarvestedKg) * HARVEST_KG_PRECISION) / HARVEST_KG_PRECISION;
    const remainingCropKg = vineyard
      ? vineyard.cropKg - vineyard.harvestedKg - (harvestedByVineyard.get(vineyard.id) ?? 0)
      : 0;
    if (completedKg + HARVEST_KG_EPSILON < activity.targetKg && remainingCropKg > HARVEST_KG_EPSILON) {
      activities.push({ ...activity, completedKg, blockedReason: activityState(activity).blockedReason });
    }
  }

  const outputs = ordered.flatMap(activity => {
    const kilograms = harvestedByActivity.get(activity.id) ?? 0;
    return kilograms > 0 ? [{ vineyardId: activity.vineyardId, kilograms, activityId: activity.id }] : [];
  });
  return {
    work: { staff: work.staff.map(worker => ({ ...worker, experience: worker.experience + (appliedXp.get(worker.id) ?? 0) })), activities },
    outputs,
  };
}
