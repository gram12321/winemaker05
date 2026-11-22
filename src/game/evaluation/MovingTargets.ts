import type { AxisAssessment, ProfileAssessment, TargetProfile } from './types';

/**
 * Provisional fit curve: a target midpoint scores 1, range edges score 0.5,
 * and normalized-domain edges score 0 outside the target range. A point target
 * scores 1 only at its point and falls linearly to 0 at either domain edge.
 */
export const MOVING_TARGET_FIT = {
  midpoint: 1,
  rangeEdge: 0.5,
  domainEdge: 0,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compareAxisKeys(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function invalidConfiguration(message: string): never {
  throw new RangeError(message);
}

/**
 * Returns a provisional triangular fit centered on the target midpoint.
 * Outside a non-point range, fit declines linearly from the range-edge fit to
 * zero at the corresponding edge of the normalized [0, 1] domain.
 */
function midpointOutsideRangeFit(value: number, low: number, high: number): number {
  if (low === high) {
    if (value === low) return MOVING_TARGET_FIT.midpoint;
    return value < low ? value / low : (1 - value) / (1 - low);
  }

  if (value < low) return MOVING_TARGET_FIT.rangeEdge * (value / low);
  if (value > high) return MOVING_TARGET_FIT.rangeEdge * ((1 - value) / (1 - high));
  if (value === low || value === high) return MOVING_TARGET_FIT.rangeEdge;
  if (value === low + (high - low) / 2) return MOVING_TARGET_FIT.midpoint;

  const positionInRange = (value - low) / (high - low);
  return MOVING_TARGET_FIT.midpoint - Math.abs(positionInRange - 0.5);
}

/**
 * Scores matching finite normalized axis values against configured ranges.
 * Axis coverage must be exact; targets and values are not modified.
 */
export function evaluateProfile(
  values: Readonly<Record<string, number>>,
  targets: TargetProfile,
): ProfileAssessment {
  if (!isRecord(values) || !isRecord(targets)) {
    return invalidConfiguration('Profile values and targets must be records.');
  }

  const axisKeys = Object.keys(targets).sort(compareAxisKeys);
  const valueKeys = Object.keys(values).sort(compareAxisKeys);
  if (axisKeys.length !== valueKeys.length || axisKeys.some((key, index) => key !== valueKeys[index])) {
    return invalidConfiguration('Profile values and targets must cover the same axes.');
  }

  let maxWeight = 0;
  const validatedTargets = new Map<string, { low: number; high: number; weight: number; reasons: readonly string[] }>();

  for (const axis of axisKeys) {
    const value = values[axis];
    const target = targets[axis];

    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
      return invalidConfiguration(`Profile value for "${axis}" must be finite and normalized to [0, 1].`);
    }
    if (!isRecord(target)) {
      return invalidConfiguration(`Target for "${axis}" must be a record.`);
    }

    const { low, high, weight, reasons } = target;
    if (typeof low !== 'number' || !Number.isFinite(low) || low < 0 || low > 1
      || typeof high !== 'number' || !Number.isFinite(high) || high < 0 || high > 1) {
      return invalidConfiguration(`Target bounds for "${axis}" must be finite and normalized to [0, 1].`);
    }
    if (low > high) {
      return invalidConfiguration(`Target lower bound must not exceed its upper bound for "${axis}".`);
    }
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0) {
      return invalidConfiguration(`Target weight for "${axis}" must be finite and nonnegative.`);
    }
    if (!Array.isArray(reasons) || reasons.some(reason => typeof reason !== 'string')) {
      return invalidConfiguration(`Target reasons for "${axis}" must be an array of strings.`);
    }

    maxWeight = Math.max(maxWeight, weight);
    validatedTargets.set(axis, { low, high, weight, reasons });
  }

  if (maxWeight === 0) {
    return invalidConfiguration('At least one target weight must be positive.');
  }

  let scaledWeightTotal = 0;
  let scaledFitTotal = 0;
  const axisAssessments: Array<[string, AxisAssessment]> = [];

  for (const axis of axisKeys) {
    const value = values[axis];
    const { low, high, weight, reasons } = validatedTargets.get(axis)!;
    const fit = Math.min(1, Math.max(0, midpointOutsideRangeFit(value, low, high)));
    const scaledWeight = weight / maxWeight;

    scaledWeightTotal += scaledWeight;
    scaledFitTotal += fit * scaledWeight;
    axisAssessments.push([axis, { value, low, high, fit, weight, reasons: [...reasons] }]);
  }

  return {
    score: Math.min(1, Math.max(0, scaledFitTotal / scaledWeightTotal)),
    axes: Object.fromEntries(axisAssessments),
  };
}
