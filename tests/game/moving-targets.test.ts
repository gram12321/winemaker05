import { describe, expect, it } from 'vitest';
import { evaluateProfile } from '../../src/game/evaluation/MovingTargets';
import type { AxisTarget, TargetProfile } from '../../src/game/evaluation/types';

function target(low: number, high: number, weight = 1, reasons: readonly string[] = []): AxisTarget {
  return { low, high, weight, reasons };
}

function fit(value: number, axisTarget: AxisTarget): number {
  return evaluateProfile({ axis: value }, { axis: axisTarget }).axes.axis.fit;
}

describe('generic moving-target evaluation', () => {
  it('scores the midpoint, range edges and out-of-range values with a continuous bounded curve', () => {
    const axisTarget = target(0.2, 0.8);
    expect(fit(0.5, axisTarget)).toBe(1);
    expect(fit(0.2, axisTarget)).toBe(0.5);
    expect(fit(0.8, axisTarget)).toBe(0.5);
    expect(fit(0.1, axisTarget)).toBeCloseTo(0.25);
    expect(fit(0.9, axisTarget)).toBeCloseTo(0.25);
    expect(fit(0, axisTarget)).toBe(0);
    expect(fit(1, axisTarget)).toBe(0);

    const justBelow = fit(0.1999, axisTarget);
    const atBoundary = fit(0.2, axisTarget);
    const justInside = fit(0.2001, axisTarget);
    expect(justBelow).toBeLessThan(atBoundary);
    expect(justInside).toBeGreaterThan(atBoundary);
    expect(Math.abs(justBelow - atBoundary)).toBeLessThan(0.001);
    expect(Math.abs(justInside - atBoundary)).toBeLessThan(0.001);

    for (const value of [0, 0.1, 0.2, 0.5, 0.8, 0.9, 1]) {
      const result = fit(value, axisTarget);
      expect(Number.isFinite(result) && result >= 0 && result <= 1).toBe(true);
    }
  });

  it('handles point targets without division by zero', () => {
    const point = target(0.5, 0.5);
    expect(fit(0.5, point)).toBe(1);
    expect(fit(0.25, point)).toBe(0.5);
    expect(fit(0.75, point)).toBe(0.5);
    expect(fit(0, point)).toBe(0);
    expect(fit(1, point)).toBe(0);
    expect(fit(0.25, target(0, 0))).toBe(0.75);
    expect(fit(0.75, target(1, 1))).toBe(0.75);
  });

  it('aggregates by normalized weights and keeps zero-weight axes out of the score', () => {
    const result = evaluateProfile(
      { a: 0.5, b: 0.1, c: 1 },
      { a: target(0.2, 0.8, 3), b: target(0.2, 0.8, 1), c: target(0.5, 0.5, 0) },
    );

    expect(result.axes.a.fit).toBe(1);
    expect(result.axes.b.fit).toBeCloseTo(0.25);
    expect(result.axes.c.weight).toBe(0);
    expect(result.score).toBeCloseTo((3 * 1 + 1 * 0.25) / 4);
  });

  it('uses stable axis ordering and leaves immutable inputs untouched while propagating reasons', () => {
    const reasons = Object.freeze(['site shifts the target', 'harvest context']);
    const targetZ = Object.freeze(target(0.2, 0.8, 1, reasons));
    const targetA = Object.freeze(target(0.1, 0.9, 2, ['variety context']));
    const values = Object.freeze({ z: 0.5, a: 0.5 });
    const targets: TargetProfile = Object.freeze({ z: targetZ, a: targetA });
    const before = structuredClone({ values, targets });

    const first = evaluateProfile(values, targets);
    const second = evaluateProfile(values, targets);

    expect(Object.keys(first.axes)).toEqual(['a', 'z']);
    expect(first).toEqual(second);
    expect(first.axes.z.reasons).toEqual(reasons);
    expect(first.axes.z.reasons).not.toBe(reasons);
    expect({ values, targets }).toEqual(before);
  });

  it('rejects incomplete axis coverage', () => {
    expect(() => evaluateProfile({ acidity: 0.5 }, { aroma: target(0, 1) })).toThrow(RangeError);
    expect(() => evaluateProfile({ acidity: 0.5, aroma: 0.5 }, { acidity: target(0, 1) })).toThrow(RangeError);
  });

  it('rejects non-finite and out-of-domain values and target bounds', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0.01, 1.01]) {
      expect(() => evaluateProfile({ axis: value }, { axis: target(0, 1) })).toThrow(RangeError);
    }
    for (const low of [Number.NaN, Number.NEGATIVE_INFINITY, -0.01, 1.01]) {
      expect(() => evaluateProfile({ axis: 0.5 }, { axis: target(low, 1) })).toThrow(RangeError);
    }
    for (const high of [Number.NaN, Number.POSITIVE_INFINITY, -0.01, 1.01]) {
      expect(() => evaluateProfile({ axis: 0.5 }, { axis: target(0, high) })).toThrow(RangeError);
    }
  });

  it('rejects reversed bounds and invalid or entirely zero weights', () => {
    expect(() => evaluateProfile({ axis: 0.5 }, { axis: target(0.8, 0.2) })).toThrow(RangeError);
    for (const weight of [-0.1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => evaluateProfile({ axis: 0.5 }, { axis: target(0, 1, weight) })).toThrow(RangeError);
    }
    expect(() => evaluateProfile({ a: 0.5, b: 0.5 }, { a: target(0, 1, 0), b: target(0, 1, 0) })).toThrow(RangeError);
  });
});
