import { clamp } from '../core/Numbers';
import { BOTTLING_MIN_ALCOHOL_PCT } from './Operations';
import type { PhysicalLot, PhysicalState, WineEnvironment } from './types';

/** Provisional daily game balance: the same physical process runs before and after bottling. */
export const MATURITY_WINDOW_START = 0.45;
export const MATURITY_WINDOW_END = 1.2;
export const MATURATION_PER_DAY_AT_REFERENCE = 1 / 365;
export const MATURATION_REFERENCE_TEMPERATURE_C = 15;
export const MATURATION_TEMPERATURE_DOUBLING_C = 15;
export const MATURATION_MIN_TEMPERATURE_FACTOR = 0.35;
export const MATURATION_MAX_TEMPERATURE_FACTOR = 2.5;
export const MATURATION_AGING_POTENTIAL_BASE = 0.55;
export const MATURATION_AGING_POTENTIAL_WEIGHT = 1.45;
export const ACID_SOFTENING_PER_MATURITY = 0.08;
export const AROMA_RELEASE_PER_MATURITY = 0.24;
export const AROMA_RELEASE_END_MATURITY = MATURITY_WINDOW_START;
export const AROMA_DECLINE_START_MATURITY = 0.95;
export const AROMA_DECLINE_PER_MATURITY = 0.5;
export const OXIDATION_AROMA_DECLINE_WEIGHT = 0.5;
export const OAK_EXTRACTION_PER_DAY = 0.004;
export const LEES_EXTRACTION_PER_DAY = 0.0015;

function assertInputs(environment: WineEnvironment, days: number): void {
  if (!Number.isSafeInteger(days) || days < 0) throw new RangeError('Maturation days must be a non-negative safe integer.');
  if (!environment || !Number.isFinite(environment.temperatureC)) throw new RangeError('Wine environment temperature must be finite.');
  if (!Number.isFinite(environment.oakStrength) || environment.oakStrength < 0 || environment.oakStrength > 1) {
    throw new RangeError('Wine oak strength must be between 0 and 1.');
  }
}

function temperatureFactor(temperatureC: number): number {
  return clamp(2 ** ((temperatureC - MATURATION_REFERENCE_TEMPERATURE_C) / MATURATION_TEMPERATURE_DOUBLING_C),
    MATURATION_MIN_TEMPERATURE_FACTOR, MATURATION_MAX_TEMPERATURE_FACTOR);
}

function advanceOneDay(lot: PhysicalLot, physical: PhysicalState, environment: WineEnvironment): PhysicalState {
  if (lot.form === 'grapes') return physical;
  const warmth = temperatureFactor(environment.temperatureC);
  // Partially fermented must needs a physical alcohol threshold; idle juice cannot age into wine.
  const canMature = lot.form === 'wine' || lot.form === 'bottled'
    || physical.alcoholPct >= BOTTLING_MIN_ALCOHOL_PCT;
  let { acidity, aroma, maturation, oak, lees } = physical;

  if (canMature) {
    const daysPerMaturityFactor = MATURATION_AGING_POTENTIAL_BASE
      + MATURATION_AGING_POTENTIAL_WEIGHT * clamp(lot.anchors.agingPotential);
    const step = MATURATION_PER_DAY_AT_REFERENCE * warmth / daysPerMaturityFactor;
    const previousMaturity = maturation;
    maturation += step;
    if (!Number.isFinite(maturation) || maturation <= previousMaturity) {
      throw new RangeError('Maturation is outside the safely advancing numeric range.');
    }
    acidity = clamp(acidity * (1 - ACID_SOFTENING_PER_MATURITY * step));

    // Early integration can release only inherited capacity not yet expressed. It never
    // repairs damage after the release window or creates aroma beyond the raw baseline.
    const releaseWindow = clamp(1 - previousMaturity / AROMA_RELEASE_END_MATURITY);
    const availableAroma = Math.max(0, lot.anchors.aromatics - aroma);
    const release = Math.min(availableAroma,
      lot.anchors.aromatics * AROMA_RELEASE_PER_MATURITY * step * releaseWindow * (1 - clamp(physical.oxidation)));
    const declineStep = Math.max(0, maturation - Math.max(previousMaturity, AROMA_DECLINE_START_MATURITY));
    aroma = clamp((aroma + release) * Math.max(0, 1 - AROMA_DECLINE_PER_MATURITY
      * declineStep * (1 + OXIDATION_AROMA_DECLINE_WEIGHT * clamp(physical.oxidation))));

    if (lot.form !== 'bottled') {
      oak = clamp(oak + (1 - oak) * environment.oakStrength * OAK_EXTRACTION_PER_DAY * warmth);
    }
  }

  // Contact is a separate finite contribution and can start during fermentation;
  // the presence of alcohol establishes that fermentation has actually begun.
  if (lot.form !== 'bottled' && lot.processes.leesContact && physical.alcoholPct > 0) {
    lees = clamp(lees + (1 - lees) * LEES_EXTRACTION_PER_DAY * warmth);
  }
  return { ...physical, acidity, aroma, maturation, oak, lees };
}

/** Advance only maturation-owned fields, using canonical daily substeps. */
export function advanceMaturation(lot: PhysicalLot, environment: WineEnvironment, days: number): PhysicalState {
  assertInputs(environment, days);
  let physical = { ...lot.physical };
  for (let day = 0; day < days; day += 1) physical = advanceOneDay(lot, physical, environment);
  return Object.freeze(physical);
}

/** Current drinking-window outlook, derived without mutating the lot. */
export function maturityOutlook(lot: PhysicalLot): { label: 'Developing' | 'In maturity window' | 'Declining'; progress: number } {
  const maturity = lot.physical.maturation;
  const label = maturity < MATURITY_WINDOW_START ? 'Developing'
    : maturity <= MATURITY_WINDOW_END ? 'In maturity window'
      : 'Declining';
  return { label, progress: clamp(maturity / MATURITY_WINDOW_END) };
}
