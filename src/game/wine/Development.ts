import { clamp } from '../core/Numbers';
import { advanceMaturation, canMatureLot } from './Maturation';
import {
  FERMENTATION_MAX_TEMPERATURE_C,
  FERMENTATION_MIN_TEMPERATURE_C,
  MIN_FERMENTABLE_SUGAR_G_PER_L,
} from './Operations';
import { advanceRisks, ROT_GROWTH_MIN_TEMPERATURE_C, STUCK_FERMENTATION_YEAST_ACTIVITY_THRESHOLD } from './Risks';
import type { PhysicalLot, PhysicalState, WineEnvironment } from './types';
import { WINE_CAPACITY_EPSILON, WINE_MATERIAL_LIMITS } from './MaterialLimits';

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
  if (!Number.isSafeInteger(physical.ageDays) || physical.ageDays < 0
    || !Number.isSafeInteger(physical.developmentAgeDays) || physical.developmentAgeDays < 0
    || physical.developmentAgeDays > physical.ageDays) {
    throw new RangeError('Elapsed lot age and wine-development age must be ordered non-negative safe integers.');
  }
  if (physical.phenolics + physical.remainingPhenolics > capacity + WINE_CAPACITY_EPSILON) {
    throw new RangeError('Wine phenolics exceed inherited capacity.');
  }
}

function assertEnvironment(environment: WineEnvironment): void {
  if (!environment || !Number.isFinite(environment.temperatureC)
    || !inRange(environment.oxygenIngress, 0, 1)
    || !inRange(environment.oakStrength, 0, 1)
    || !inRange(environment.contaminationRisk, 0, 1)) {
    throw new RangeError('Wine environment must have a finite temperature and normalized pressures.');
  }
}

function assertInputs(
  lot: PhysicalLot,
  environment: WineEnvironment | ((lot: PhysicalLot) => WineEnvironment),
  days: number,
): void {
  if (!Number.isSafeInteger(days) || days < 0) throw new RangeError('Development days must be a non-negative safe integer.');
  if (!lot || typeof lot !== 'object' || !lot.anchors || !lot.processes) throw new RangeError('Wine lot and its physical inputs are required.');
  if (!['grapes', 'must', 'wine', 'bottled'].includes(lot.form)) throw new RangeError('Wine material form is invalid.');
  if (!inRange(lot.anchors.sugarGPerL, 0, MAX_SUGAR_G_PER_L)
    || ![lot.anchors.acidity, lot.anchors.phenolics, lot.anchors.aromatics, lot.anchors.body, lot.anchors.agingPotential]
      .every(value => inRange(value, 0, 1))) {
    throw new RangeError('Wine raw material anchors are invalid.');
  }
  assertPhysical(lot.physical, lot.anchors.phenolics);
  if (lot.form === 'grapes' && lot.physical.developmentAgeDays !== 0) {
    throw new RangeError('Whole grapes cannot have wine-development age.');
  }
  if (lot.physical.sugarGPerL > lot.anchors.sugarGPerL + WINE_CAPACITY_EPSILON) {
    throw new RangeError('Wine sugar exceeds its inherited capacity.');
  }
  if (lot.physical.aroma > lot.anchors.aromatics + WINE_CAPACITY_EPSILON) {
    throw new RangeError('Wine aroma exceeds its inherited capacity.');
  }
  if (days > Number.MAX_SAFE_INTEGER - lot.physical.ageDays) throw new RangeError('Wine age cannot be safely advanced by that many days.');
  if (days > Number.MAX_SAFE_INTEGER - lot.physical.developmentAgeDays) throw new RangeError('Wine-development age cannot be safely advanced by that many days.');
  if (typeof lot.processes.fermenting !== 'boolean' || typeof lot.processes.skinContact !== 'boolean'
    || typeof lot.processes.leesContact !== 'boolean'
    || !inRange(lot.processes.temperatureC, FERMENTATION_MIN_TEMPERATURE_C, FERMENTATION_MAX_TEMPERATURE_C)) {
    throw new RangeError('Wine process settings are invalid.');
  }
  if (typeof environment !== 'function') assertEnvironment(environment);
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

/** Environmental facts and risk changes observed during one canonical development day. */
interface DevelopmentObservation {
  readonly environment: WineEnvironment;
  readonly fermentationActive: boolean;
  readonly sugarGPerL: number;
  readonly oxygenExposureIncrease: number;
  readonly oxidationIncrease: number;
  readonly rotIncrease: number;
  readonly greenCharacterSoftened: number;
}

function observeDevelopmentStep(
  before: PhysicalLot,
  after: PhysicalLot,
  environment: WineEnvironment,
): DevelopmentObservation {
  return Object.freeze({
    environment: Object.freeze({ ...environment }),
    fermentationActive: before.processes.fermenting,
    sugarGPerL: after.physical.sugarGPerL,
    oxygenExposureIncrease: Math.max(0, after.physical.oxygenExposure - before.physical.oxygenExposure),
    oxidationIncrease: Math.max(0, after.physical.oxidation - before.physical.oxidation),
    rotIncrease: Math.max(0, after.physical.rot - before.physical.rot),
    greenCharacterSoftened: Math.max(0, before.physical.greenCharacter - after.physical.greenCharacter),
  });
}

function riskCauseSummaries(observations: readonly DevelopmentObservation[]): string[] {
  const oxygenGroups = new Map<string, {
    readonly environment: WineEnvironment;
    readonly fermentationActive: boolean;
    oxygenExposureIncrease: number;
    oxidationIncrease: number;
  }>();
  const rotGroups = new Map<string, {
    readonly observation: DevelopmentObservation;
    rotIncrease: number;
  }>();
  const greenGroups = new Map<string, {
    readonly environment: WineEnvironment;
    readonly fermentationActive: boolean;
    greenCharacterSoftened: number;
  }>();

  for (const observation of observations) {
    const { environment } = observation;
    if (observation.oxygenExposureIncrease > 0 || observation.oxidationIncrease > 0) {
      const key = JSON.stringify([environment.oxygenIngress, environment.temperatureC, observation.fermentationActive]);
      const group = oxygenGroups.get(key) ?? {
        environment,
        fermentationActive: observation.fermentationActive,
        oxygenExposureIncrease: 0,
        oxidationIncrease: 0,
      };
      group.oxygenExposureIncrease += observation.oxygenExposureIncrease;
      group.oxidationIncrease += observation.oxidationIncrease;
      oxygenGroups.set(key, group);
    }
    if (observation.rotIncrease > 0) {
      const key = JSON.stringify([
        environment.contaminationRisk,
        environment.temperatureC,
        observation.fermentationActive,
        observation.sugarGPerL > MIN_FERMENTABLE_SUGAR_G_PER_L,
      ]);
      const group = rotGroups.get(key) ?? { observation, rotIncrease: 0 };
      group.rotIncrease += observation.rotIncrease;
      rotGroups.set(key, group);
    }
    if (observation.greenCharacterSoftened > 0) {
      const key = JSON.stringify([environment.temperatureC, observation.fermentationActive]);
      const group = greenGroups.get(key) ?? {
        environment,
        fermentationActive: observation.fermentationActive,
        greenCharacterSoftened: 0,
      };
      group.greenCharacterSoftened += observation.greenCharacterSoftened;
      greenGroups.set(key, group);
    }
  }

  const causes: string[] = [];
  for (const group of oxygenGroups.values()) {
    const phase = group.fermentationActive ? 'fermenting' : 'cellar';
    causes.push(`Oxygen exposure/oxidation: +${amount(group.oxygenExposureIncrease)}/+${amount(group.oxidationIncrease)} at ${amount(group.environment.oxygenIngress)}/day oxygen ingress, ${amount(group.environment.temperatureC)}°C ${phase}.`);
  }
  for (const group of rotGroups.values()) {
    const { observation } = group;
    const { environment } = observation;
    const warm = environment.temperatureC >= ROT_GROWTH_MIN_TEMPERATURE_C;
    const sugar = observation.sugarGPerL > MIN_FERMENTABLE_SUGAR_G_PER_L;
    const phase = observation.fermentationActive ? 'fermenting' : 'cellar';
    causes.push(`Rot: +${amount(group.rotIncrease)}; contamination ${amount(environment.contaminationRisk)}, ${amount(environment.temperatureC)}°C ${warm ? 'warm' : 'cool'}, sugar ${sugar ? '>' : '≤'}${MIN_FERMENTABLE_SUGAR_G_PER_L} g/L (${phase}).`);
  }
  for (const group of greenGroups.values()) {
    const phase = group.fermentationActive ? 'fermenting' : 'cellar';
    causes.push(`Green character softened: -${amount(group.greenCharacterSoftened)} at ${amount(group.environment.temperatureC)}°C ${phase}.`);
  }
  return causes;
}

/** Summarize observed changes alongside the actual conditions on affected days. */
function describeDevelopment(
  before: PhysicalLot,
  after: PhysicalLot,
  observations: readonly DevelopmentObservation[],
): readonly string[] {
  const causes: string[] = [];
  const initial = before.physical;
  const final = after.physical;
  if (final.ageDays === initial.ageDays && final.developmentAgeDays === initial.developmentAgeDays) return Object.freeze(causes);
  const sugarConsumed = initial.sugarGPerL - final.sugarGPerL;
  const alcoholProduced = final.alcoholPct - initial.alcoholPct;
  const extracted = final.phenolics - initial.phenolics;
  if (sugarConsumed > 0) causes.push(`Fermentation: sugar -${amount(sugarConsumed)} g/L, alcohol +${amount(alcoholProduced)} points.`);
  if (before.processes.fermenting && !after.processes.fermenting && after.form === 'wine') {
    causes.push(`Fermentation complete at ${amount(final.sugarGPerL)} g/L sugar.`);
  } else if (after.processes.fermenting && sugarConsumed === 0) {
    causes.push(`Fermentation converted no sugar; ${amount(final.sugarGPerL)} g/L remains with yeast activity ${amount(final.yeastActivity)}.`);
  } else if (after.processes.fermenting && final.yeastActivity < STUCK_FERMENTATION_YEAST_ACTIVITY_THRESHOLD) {
    causes.push(`Fermentation stalled with ${amount(final.sugarGPerL)} g/L sugar and yeast activity ${amount(final.yeastActivity)}.`);
  }
  if (extracted > 0) causes.push(`Skins: phenolics +${amount(extracted)}.`);
  if (final.maturation > initial.maturation) causes.push(`Maturation +${amount(final.maturation - initial.maturation)}.`);
  if (final.oak > initial.oak) causes.push(`Oak +${amount(final.oak - initial.oak)}.`);
  if (final.lees > initial.lees) causes.push(`Lees +${amount(final.lees - initial.lees)}.`);
  causes.push(...riskCauseSummaries(observations));
  if (final.ageDays > initial.ageDays || final.developmentAgeDays > initial.developmentAgeDays) {
    causes.push(`Age +${final.ageDays - initial.ageDays}d (wine +${final.developmentAgeDays - initial.developmentAgeDays}d).`);
  }
  return Object.freeze(causes);
}

/** One authoritative, pure physical development result with deterministic daily ordering. */
export function developLot(
  lot: PhysicalLot,
  /** Optional pure resolver is called once per day before the lot advances. */
  environment: WineEnvironment | ((lot: PhysicalLot) => WineEnvironment),
  days: number,
): { lot: PhysicalLot; causes: readonly string[] } {
  assertInputs(lot, environment, days);
  let current = lot;
  const observations: DevelopmentObservation[] = [];
  for (let day = 0; day < days; day += 1) {
    const dayEnvironment = typeof environment === 'function' ? environment(current) : environment;
    assertEnvironment(dayEnvironment);
    const beforeDay = current;
    const transformed = advanceFermentationAndExtraction(current, dayEnvironment);
    const matured = { ...transformed, physical: advanceMaturation(transformed, dayEnvironment, 1) };
    const riskPhysical = advanceRisks(matured, dayEnvironment, 1);
    if (dayEnvironment.oxygenIngress > 0 && riskPhysical.oxygenExposure === matured.physical.oxygenExposure) {
      throw new RangeError('Wine oxygen exposure cannot be advanced at its current precision.');
    }
    const developmentDays = canMatureLot(matured) ? 1 : 0;
    const physical = Object.freeze({
      ...riskPhysical,
      ageDays: current.physical.ageDays + 1,
      developmentAgeDays: current.physical.developmentAgeDays + developmentDays,
    });
    assertPhysical(physical, current.anchors.phenolics);
    current = Object.freeze({ ...matured, physical });
    observations.push(observeDevelopmentStep(beforeDay, current, dayEnvironment));
  }
  return { lot: current, causes: describeDevelopment(lot, current, observations) };
}
