import { clamp } from '../core/Numbers';
import { advanceMaturation } from './Maturation';
import {
  FERMENTATION_MAX_TEMPERATURE_C,
  FERMENTATION_MIN_TEMPERATURE_C,
  MIN_FERMENTABLE_SUGAR_G_PER_L,
} from './Operations';
import { advanceRisks, STUCK_FERMENTATION_YEAST_ACTIVITY_THRESHOLD } from './Risks';
import type { PhysicalLot, PhysicalState, WineEnvironment } from './types';
import { WINE_MATERIAL_LIMITS } from './MaterialLimits';

/** Provisional game balance, expressed per day; these are not scientific measurements. */
export const FERMENTATION_SUGAR_G_PER_L_PER_DAY = 8;
export const FERMENTATION_ALCOHOL_PCT_PER_G_PER_L_SUGAR = 0.058;
export const FERMENTATION_FULL_RATE_YEAST_ACTIVITY = 0.5;
export const FERMENTATION_COLD_STALL_C = 8;
export const FERMENTATION_OPTIMUM_C = 20;
export const FERMENTATION_HOT_STALL_C = 34;
export const FERMENTATION_ALCOHOL_STRESS_START_PCT = 16;
export const FERMENTATION_ALCOHOL_STALL_PCT = 20;
export const YEAST_GROWTH_PER_DAY = 0.08;
export const YEAST_STRESS_LOSS_PER_DAY = 0.04;
export const SKIN_EXTRACTION_FRACTION_PER_DAY = 0.05;
export const SKIN_EXTRACTION_ZERO_TEMPERATURE_C = 2;
export const SKIN_EXTRACTION_REFERENCE_TEMPERATURE_C = 20;
export const SKIN_EXTRACTION_MAX_TEMPERATURE_FACTOR = 1.5;
export const SKIN_EXTRACTION_ALCOHOL_REFERENCE_PCT = 20;
export const SKIN_EXTRACTION_MAX_ALCOHOL_BONUS = 0.5;

const MAX_SUGAR_G_PER_L = WINE_MATERIAL_LIMITS.sugarGPerL;
const MAX_ALCOHOL_PCT = WINE_MATERIAL_LIMITS.alcoholPct;
// Weighted blending can introduce tiny rounding differences in inherited capacity.
const CAPACITY_EPSILON = 1e-7;

function inRange(value: number, minimum: number, maximum: number): boolean {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

function assertPhysical(physical: PhysicalState, capacity: number): void {
  if (!physical || typeof physical !== 'object') throw new RangeError('Wine physical state is required.');
  if (!inRange(physical.sugarGPerL, 0, MAX_SUGAR_G_PER_L)
    || !inRange(physical.alcoholPct, 0, MAX_ALCOHOL_PCT)) {
    throw new RangeError('Wine sugar or alcohol is outside the supported range.');
  }
  for (const value of [physical.acidity, physical.phenolics, physical.remainingPhenolics,
    physical.aroma, physical.yeastActivity, physical.oxidation, physical.oak,
    physical.lees, physical.greenCharacter, physical.rot]) {
    if (!inRange(value, 0, 1)) throw new RangeError('Normalized wine physical values must be between 0 and 1.');
  }
  if (!inRange(physical.oxygenExposure, 0, Number.MAX_VALUE)
    || !inRange(physical.maturation, 0, Number.MAX_VALUE)) {
    throw new RangeError('Wine oxygen exposure and maturation must be non-negative and finite.');
  }
  if (!Number.isSafeInteger(physical.ageDays) || physical.ageDays < 0) {
    throw new RangeError('Wine age must be a non-negative safe integer.');
  }
  if (physical.phenolics + physical.remainingPhenolics > capacity + CAPACITY_EPSILON) {
    throw new RangeError('Wine phenolics exceed inherited capacity.');
  }
}

function assertInputs(lot: PhysicalLot, environment: WineEnvironment, days: number): void {
  if (!Number.isSafeInteger(days) || days < 0) throw new RangeError('Development days must be a non-negative safe integer.');
  if (!lot || typeof lot !== 'object' || !lot.anchors || !lot.processes) throw new RangeError('Wine lot and its physical inputs are required.');
  if (!['grapes', 'must', 'wine', 'bottled'].includes(lot.form)) throw new RangeError('Wine material form is invalid.');
  if (!inRange(lot.anchors.sugarGPerL, 0, MAX_SUGAR_G_PER_L)
    || ![lot.anchors.acidity, lot.anchors.phenolics, lot.anchors.aromatics, lot.anchors.body, lot.anchors.agingPotential]
      .every(value => inRange(value, 0, 1))) {
    throw new RangeError('Wine raw material anchors are invalid.');
  }
  assertPhysical(lot.physical, lot.anchors.phenolics);
  if (lot.physical.sugarGPerL > lot.anchors.sugarGPerL + CAPACITY_EPSILON) {
    throw new RangeError('Wine sugar exceeds its inherited capacity.');
  }
  if (days > Number.MAX_SAFE_INTEGER - lot.physical.ageDays) throw new RangeError('Wine age cannot be safely advanced by that many days.');
  if (typeof lot.processes.fermenting !== 'boolean' || typeof lot.processes.skinContact !== 'boolean'
    || typeof lot.processes.leesContact !== 'boolean'
    || !inRange(lot.processes.temperatureC, FERMENTATION_MIN_TEMPERATURE_C, FERMENTATION_MAX_TEMPERATURE_C)) {
    throw new RangeError('Wine process settings are invalid.');
  }
  if (!environment || !Number.isFinite(environment.temperatureC)
    || !inRange(environment.oxygenIngress, 0, 1)
    || !inRange(environment.oakStrength, 0, 1)
    || !inRange(environment.contaminationRisk, 0, 1)) {
    throw new RangeError('Wine environment must have a finite temperature and normalized pressures.');
  }
}

function fermentationTemperatureFit(temperatureC: number): number {
  if (temperatureC <= FERMENTATION_COLD_STALL_C || temperatureC >= FERMENTATION_HOT_STALL_C) return 0;
  if (temperatureC <= FERMENTATION_OPTIMUM_C) {
    return (temperatureC - FERMENTATION_COLD_STALL_C) / (FERMENTATION_OPTIMUM_C - FERMENTATION_COLD_STALL_C);
  }
  return (FERMENTATION_HOT_STALL_C - temperatureC) / (FERMENTATION_HOT_STALL_C - FERMENTATION_OPTIMUM_C);
}

function alcoholFit(alcoholPct: number): number {
  return clamp((FERMENTATION_ALCOHOL_STALL_PCT - alcoholPct)
    / (FERMENTATION_ALCOHOL_STALL_PCT - FERMENTATION_ALCOHOL_STRESS_START_PCT));
}

function skinTemperatureFactor(temperatureC: number): number {
  // Bound temperature before arithmetic so even extreme finite environments remain finite.
  if (temperatureC <= SKIN_EXTRACTION_ZERO_TEMPERATURE_C) return 0;
  const maximumC = SKIN_EXTRACTION_ZERO_TEMPERATURE_C
    + (SKIN_EXTRACTION_REFERENCE_TEMPERATURE_C - SKIN_EXTRACTION_ZERO_TEMPERATURE_C) * SKIN_EXTRACTION_MAX_TEMPERATURE_FACTOR;
  if (temperatureC >= maximumC) return SKIN_EXTRACTION_MAX_TEMPERATURE_FACTOR;
  return (temperatureC - SKIN_EXTRACTION_ZERO_TEMPERATURE_C)
    / (SKIN_EXTRACTION_REFERENCE_TEMPERATURE_C - SKIN_EXTRACTION_ZERO_TEMPERATURE_C);
}

function advanceFermentationAndExtraction(lot: PhysicalLot, environment: WineEnvironment): PhysicalLot {
  if (lot.form !== 'must' && lot.form !== 'wine') return lot;

  const previous = lot.physical;
  let { sugarGPerL, alcoholPct, yeastActivity, phenolics, remainingPhenolics } = previous;
  let completed = false;

  if (lot.processes.fermenting) {
    if (sugarGPerL > MIN_FERMENTABLE_SUGAR_G_PER_L) {
      const fit = fermentationTemperatureFit(environment.temperatureC) * alcoholFit(alcoholPct);
      // Once activity has fallen below the diagnostic threshold, recovery is an explicit operation.
      if (yeastActivity >= STUCK_FERMENTATION_YEAST_ACTIVITY_THRESHOLD) {
        const availableSugar = sugarGPerL - MIN_FERMENTABLE_SUGAR_G_PER_L;
        const rate = FERMENTATION_SUGAR_G_PER_L_PER_DAY
          * clamp(yeastActivity / FERMENTATION_FULL_RATE_YEAST_ACTIVITY) * fit;
        const nextSugar = Math.max(MIN_FERMENTABLE_SUGAR_G_PER_L, sugarGPerL - Math.min(availableSugar, rate));
        // Use the actual representable decrement rather than the planned rate for material accounting.
        const convertedSugar = sugarGPerL - nextSugar;
        sugarGPerL = nextSugar;
        alcoholPct += convertedSugar * FERMENTATION_ALCOHOL_PCT_PER_G_PER_L_SUGAR;
        yeastActivity = clamp(yeastActivity + YEAST_GROWTH_PER_DAY * fit * (1 - yeastActivity)
          - YEAST_STRESS_LOSS_PER_DAY * (1 - fit));
      }
    }
    completed = sugarGPerL <= MIN_FERMENTABLE_SUGAR_G_PER_L;
  }

  if (lot.processes.skinContact && remainingPhenolics > 0) {
    const alcoholFactor = 1 + SKIN_EXTRACTION_MAX_ALCOHOL_BONUS
      * clamp(alcoholPct / SKIN_EXTRACTION_ALCOHOL_REFERENCE_PCT);
    const transfer = Math.min(remainingPhenolics, Math.max(0, lot.anchors.phenolics - phenolics),
      remainingPhenolics * SKIN_EXTRACTION_FRACTION_PER_DAY * skinTemperatureFactor(environment.temperatureC) * alcoholFactor);
    const nextPhenolics = Math.min(lot.anchors.phenolics, phenolics + transfer);
    const realizedTransfer = nextPhenolics - phenolics;
    // Do not deplete the reservoir when a tiny addition cannot be represented, or
    // when rounding would otherwise create more expressed material than remains.
    if (realizedTransfer > 0 && realizedTransfer <= remainingPhenolics) {
      phenolics = nextPhenolics;
      remainingPhenolics = Math.max(0, remainingPhenolics - realizedTransfer);
    }
  }

  return {
    ...lot,
    form: completed ? 'wine' : lot.form,
    physical: { ...previous, sugarGPerL, alcoholPct, yeastActivity, phenolics, remainingPhenolics },
    processes: completed ? { ...lot.processes, fermenting: false } : lot.processes,
  };
}

function amount(value: number): string {
  return Number(value.toPrecision(5)).toString();
}

/** Summarize observed changes without inventing conditions that may vary within an interval. */
export function describeDevelopment(before: PhysicalLot, after: PhysicalLot): readonly string[] {
  const causes: string[] = [];
  const initial = before.physical;
  const final = after.physical;
  if (final.ageDays === initial.ageDays) return Object.freeze(causes);
  const sugarConsumed = initial.sugarGPerL - final.sugarGPerL;
  const alcoholProduced = final.alcoholPct - initial.alcoholPct;
  const extracted = final.phenolics - initial.phenolics;
  if (sugarConsumed > 0) causes.push(`Fermentation converted ${amount(sugarConsumed)} g/L sugar into ${amount(alcoholProduced)} alcohol percentage points.`);
  if (before.processes.fermenting && !after.processes.fermenting && after.form === 'wine') {
    causes.push(`Fermentation completed with ${amount(final.sugarGPerL)} g/L residual sugar.`);
  } else if (after.processes.fermenting && sugarConsumed === 0) {
    causes.push(`Fermentation converted no sugar; ${amount(final.sugarGPerL)} g/L remains with yeast activity ${amount(final.yeastActivity)}.`);
  } else if (after.processes.fermenting && final.yeastActivity < STUCK_FERMENTATION_YEAST_ACTIVITY_THRESHOLD) {
    causes.push(`Fermentation stalled with ${amount(final.sugarGPerL)} g/L sugar and yeast activity ${amount(final.yeastActivity)}.`);
  }
  if (extracted > 0) causes.push(`Skin contact extracted ${amount(extracted)} of the finite phenolic capacity.`);
  if (final.maturation > initial.maturation) causes.push(`Maturation increased by ${amount(final.maturation - initial.maturation)}.`);
  if (final.oak > initial.oak) causes.push(`Oak influence increased by ${amount(final.oak - initial.oak)}.`);
  if (final.lees > initial.lees) causes.push(`Lees influence increased by ${amount(final.lees - initial.lees)}.`);
  if (final.oxygenExposure > initial.oxygenExposure) causes.push(`Oxygen exposure increased by ${amount(final.oxygenExposure - initial.oxygenExposure)}.`);
  if (final.oxidation > initial.oxidation) causes.push(`Oxidation increased by ${amount(final.oxidation - initial.oxidation)}.`);
  if (final.rot > initial.rot) causes.push(`Rot increased by ${amount(final.rot - initial.rot)}.`);
  if (final.greenCharacter < initial.greenCharacter) causes.push(`Green character softened by ${amount(initial.greenCharacter - final.greenCharacter)}.`);
  if (final.ageDays > initial.ageDays) causes.push(`Aged ${final.ageDays - initial.ageDays} days.`);
  return Object.freeze(causes);
}

/** One authoritative, pure physical development result with deterministic daily ordering. */
export function developLot(lot: PhysicalLot, environment: WineEnvironment, days: number): { lot: PhysicalLot; causes: readonly string[] } {
  assertInputs(lot, environment, days);
  let current = lot;
  for (let day = 0; day < days; day += 1) {
    const transformed = advanceFermentationAndExtraction(current, environment);
    const matured = { ...transformed, physical: advanceMaturation(transformed, environment, 1) };
    const riskPhysical = advanceRisks(matured, environment, 1);
    if (environment.oxygenIngress > 0 && riskPhysical.oxygenExposure === matured.physical.oxygenExposure) {
      throw new RangeError('Wine oxygen exposure cannot be advanced at its current precision.');
    }
    const physical = Object.freeze({ ...riskPhysical, ageDays: current.physical.ageDays + 1 });
    assertPhysical(physical, current.anchors.phenolics);
    current = Object.freeze({ ...matured, physical });
  }
  return { lot: current, causes: describeDevelopment(lot, current) };
}
