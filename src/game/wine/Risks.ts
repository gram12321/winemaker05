import { clamp } from '../core/Numbers';
import { MIN_FERMENTABLE_SUGAR_G_PER_L } from './Operations';
import type { PhysicalLot, PhysicalState, WineEnvironment } from './types';
import type { WineFault } from '../evaluation/types';

/** Provisional daily risk balance values. Environment pressure values are normalized to 0..1. */
export const OXIDATION_PER_OXYGEN_EXPOSURE = 0.08;
export const OXIDATION_REFERENCE_TEMPERATURE_C = 15;
export const OXIDATION_TEMPERATURE_FACTOR_PER_C = 0.025;
export const OXIDATION_TEMPERATURE_FACTOR_MIN = 0.5;
export const OXIDATION_TEMPERATURE_FACTOR_MAX = 1.75;
export const CONTAMINATION_ROT_RATE_PER_DAY = 0.0018;
export const ROT_GROWTH_MIN_TEMPERATURE_C = 18;
export const ROT_REFERENCE_TEMPERATURE_C = 20;
export const ROT_TEMPERATURE_FACTOR_PER_C = 0.03;
export const ROT_TEMPERATURE_FACTOR_MIN = 0.5;
export const ROT_TEMPERATURE_FACTOR_MAX = 1.6;
export const ROT_SUGAR_SUSCEPTIBILITY_MULTIPLIER = 1.25;
export const GREEN_CHARACTER_FADE_PER_DAY = 0.0006;
export const GREEN_FADE_REFERENCE_TEMPERATURE_C = 15;
export const GREEN_FADE_TEMPERATURE_FACTOR_PER_C = 0.02;
export const GREEN_FADE_TEMPERATURE_FACTOR_MIN = 0.5;
export const GREEN_FADE_TEMPERATURE_FACTOR_MAX = 1.5;

/** Fermentation restart restores at least 0.24 activity; lower activity is considered stalled. */
export const STUCK_FERMENTATION_YEAST_ACTIVITY_THRESHOLD = 0.08;

/** Fault reporting and severe physical fault thresholds are independent of structural fit. */
export const OXIDATION_DIAGNOSIS_THRESHOLD = 0.2;
export const ROT_DIAGNOSIS_THRESHOLD = 0.15;
export const GREEN_CHARACTER_DIAGNOSIS_THRESHOLD = 0.3;
export const SEVERE_OXIDATION_THRESHOLD = 0.65;
export const SEVERE_ROT_THRESHOLD = 0.55;

function assertInputs(environment: WineEnvironment, days: number): void {
  if (!Number.isSafeInteger(days) || days < 0) {
    throw new RangeError('Risk advancement days must be a non-negative safe integer.');
  }
  if (!environment || !Number.isFinite(environment.temperatureC)) {
    throw new RangeError('Wine environment temperature must be finite.');
  }
  if (!Number.isFinite(environment.oxygenIngress) || environment.oxygenIngress < 0 || environment.oxygenIngress > 1) {
    throw new RangeError('Wine oxygen ingress must be between 0 and 1.');
  }
  if (!Number.isFinite(environment.contaminationRisk) || environment.contaminationRisk < 0 || environment.contaminationRisk > 1) {
    throw new RangeError('Wine contamination risk must be between 0 and 1.');
  }
}

function oxidationTemperatureFactor(temperatureC: number): number {
  return clamp(
    1 + (temperatureC - OXIDATION_REFERENCE_TEMPERATURE_C) * OXIDATION_TEMPERATURE_FACTOR_PER_C,
    OXIDATION_TEMPERATURE_FACTOR_MIN,
    OXIDATION_TEMPERATURE_FACTOR_MAX,
  );
}

function greenFadeTemperatureFactor(temperatureC: number): number {
  return clamp(
    1 + (temperatureC - GREEN_FADE_REFERENCE_TEMPERATURE_C) * GREEN_FADE_TEMPERATURE_FACTOR_PER_C,
    GREEN_FADE_TEMPERATURE_FACTOR_MIN,
    GREEN_FADE_TEMPERATURE_FACTOR_MAX,
  );
}

function rotTemperatureFactor(temperatureC: number): number {
  return clamp(
    1 + (temperatureC - ROT_REFERENCE_TEMPERATURE_C) * ROT_TEMPERATURE_FACTOR_PER_C,
    ROT_TEMPERATURE_FACTOR_MIN,
    ROT_TEMPERATURE_FACTOR_MAX,
  );
}

function advanceOneDay(physical: PhysicalState, environment: WineEnvironment): PhysicalState {
  // Ingress is already expressed as exposure per day by the environment resolver.
  const oxygenExposure = physical.oxygenExposure + environment.oxygenIngress;
  const oxidation = clamp(
    physical.oxidation
      + environment.oxygenIngress
        * OXIDATION_PER_OXYGEN_EXPOSURE
        * oxidationTemperatureFactor(environment.temperatureC)
        * (1 - physical.oxidation),
  );

  // Contamination needs pressure and at least one growth condition: warmth or residual fermentable sugar.
  const rotCanGrow = environment.contaminationRisk > 0
    && (environment.temperatureC >= ROT_GROWTH_MIN_TEMPERATURE_C
      || physical.sugarGPerL > MIN_FERMENTABLE_SUGAR_G_PER_L);
  const warmFactor = rotTemperatureFactor(environment.temperatureC);
  const sugarFactor = physical.sugarGPerL > MIN_FERMENTABLE_SUGAR_G_PER_L
    ? ROT_SUGAR_SUSCEPTIBILITY_MULTIPLIER
    : 1;
  const rot = rotCanGrow
    ? clamp(
      physical.rot
        + environment.contaminationRisk
          * CONTAMINATION_ROT_RATE_PER_DAY
          * warmFactor
          * sugarFactor
          * (1 - physical.rot),
    )
    : physical.rot;

  // Time can soften inherited green character; this rule never creates it.
  const greenCharacter = physical.greenCharacter > 0
    ? clamp(physical.greenCharacter * (1 - GREEN_CHARACTER_FADE_PER_DAY * greenFadeTemperatureFactor(environment.temperatureC)))
    : 0;

  return {
    ...physical,
    oxygenExposure,
    oxidation,
    rot,
    greenCharacter,
  };
}

/** Advance risk-owned cumulative fields one deterministic day at a time. */
export function advanceRisks(lot: PhysicalLot, environment: WineEnvironment, days: number): PhysicalState {
  assertInputs(environment, days);
  let physical = { ...lot.physical };
  for (let day = 0; day < days; day += 1) {
    physical = advanceOneDay(physical, environment);
  }
  return Object.freeze(physical);
}

function fault(code: string, severity: number, explanation: string): WineFault {
  return Object.freeze({ code, severity: clamp(severity), explanation });
}

/** Derive physical faults from current material/process facts, separate from structure fit. */
export function diagnoseWine(lot: PhysicalLot): readonly WineFault[] {
  const { physical } = lot;
  const faults: WineFault[] = [];

  if (physical.oxidation >= OXIDATION_DIAGNOSIS_THRESHOLD) {
    faults.push(fault(
      'oxidation',
      physical.oxidation,
      `Oxidation is ${physical.oxidation.toFixed(2)} after ${physical.oxygenExposure.toFixed(3)} accumulated oxygen exposure.`,
    ));
  }
  if (physical.rot >= ROT_DIAGNOSIS_THRESHOLD) {
    faults.push(fault(
      'spoilage',
      physical.rot,
      `Rot is ${physical.rot.toFixed(2)}; this burden can be inherited from harvest or grow under cellar contamination pressure.`,
    ));
  }
  if (physical.greenCharacter >= GREEN_CHARACTER_DIAGNOSIS_THRESHOLD) {
    faults.push(fault(
      'green-character',
      physical.greenCharacter,
      `Green character remains at ${physical.greenCharacter.toFixed(2)}; under-ripe material or pressing can contribute, and time can soften it.`,
    ));
  }
  if (lot.processes.fermenting
    && physical.sugarGPerL > MIN_FERMENTABLE_SUGAR_G_PER_L
    && physical.yeastActivity < STUCK_FERMENTATION_YEAST_ACTIVITY_THRESHOLD) {
    const yeastShortfall = 1 - physical.yeastActivity / STUCK_FERMENTATION_YEAST_ACTIVITY_THRESHOLD;
    const residualSugar = clamp((physical.sugarGPerL - MIN_FERMENTABLE_SUGAR_G_PER_L) / 40);
    faults.push(fault(
      'stuck-fermentation',
      yeastShortfall * 0.75 + residualSugar * 0.25,
      `Fermentation is active with ${physical.sugarGPerL.toFixed(1)} g/L sugar and yeast activity ${physical.yeastActivity.toFixed(2)}, below the ${STUCK_FERMENTATION_YEAST_ACTIVITY_THRESHOLD.toFixed(2)} activity threshold.`,
    ));
  }

  return Object.freeze(faults);
}

/** Severe physical risk is limited to oxidation and spoilage, never structural imbalance. */
export function hasSeverePhysicalFault(lot: PhysicalLot): boolean {
  return lot.physical.oxidation >= SEVERE_OXIDATION_THRESHOLD
    || lot.physical.rot >= SEVERE_ROT_THRESHOLD;
}
