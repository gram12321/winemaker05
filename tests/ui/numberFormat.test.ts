import { describe, expect, it } from 'vitest';

import {
  formatCompactNumber,
  formatEurCents,
  formatNumber,
  formatPercent,
  formatRatio,
  formatScore,
} from '../../src/shared/numberFormat';

describe('number formatting', () => {
  it('uses deterministic European separators and keeps ordinary precision concise', () => {
    expect(formatNumber(1_234_567.89123)).toBe('1 234 567,89');
    expect(formatNumber(1_234)).toBe('1 234');
    expect(formatNumber(-1_234.5)).toBe('-1 234,5');
    expect(formatNumber(-0)).toBe('0');
    expect(formatNumber(-0, { fractionDigits: 2 })).toBe('0,00');
  });

  it('supports minimum, maximum, and fixed fraction digits', () => {
    expect(formatNumber(12, { minimumFractionDigits: 2 })).toBe('12,00');
    expect(formatNumber(12.345, { maximumFractionDigits: 2 })).toBe('12,35');
    expect(formatNumber(12.3, { fractionDigits: 3 })).toBe('12,300');
    expect(() => formatNumber(12, { minimumFractionDigits: 3, maximumFractionDigits: 2 })).toThrow(RangeError);
    expect(() => formatNumber(12, { fractionDigits: 2, maximumFractionDigits: 2 })).toThrow(RangeError);
  });

  it('adapts small non-zero values while retaining a visible bound when precision is capped', () => {
    expect(formatNumber(0.00004)).toBe('0,00004');
    expect(formatNumber(-0.00004)).toBe('-0,00004');
    expect(formatNumber(0.00004, { maximumFractionDigits: 2 })).toBe('<0,005');
    expect(formatNumber(-0.00004, { maximumFractionDigits: 2 })).toBe('>-0,005');
    expect(formatNumber(1e-20, { maxAdaptiveFractionDigits: 8 })).toBe('<0,000000005');
    expect(formatNumber(0.00004, { fractionDigits: 2 })).toBe('0,00');
  });

  it('formats ratios, percentages, and scores with distinct semantics', () => {
    expect(formatRatio(0.123456)).toBe('0,1235');
    expect(formatRatio(0.00004)).toBe('0,00004');
    expect(formatPercent(0.125)).toBe('12,5 %');
    expect(formatPercent(0.0004)).toBe('0,04 %');
    expect(formatScore(0.75)).toBe('75/100');
  });

  it('allows fixed precision through semantic number helpers', () => {
    expect(formatRatio(1.2, { fractionDigits: 2 })).toBe('1,20');
    expect(formatScore(0.12345, { fractionDigits: 2 })).toBe('12,35/100');
    expect(formatPercent(0.12345, { fractionDigits: 2 })).toBe('12,35 %');
    expect(formatRatio(0.123456, { minimumFractionDigits: 5 })).toBe('0,12346');
  });

  it('renders explicit representations for non-finite numbers', () => {
    expect(formatNumber(Number.NaN)).toBe('NaN');
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe('Infinity');
    expect(formatNumber(Number.NEGATIVE_INFINITY)).toBe('-Infinity');
    expect(formatPercent(Number.POSITIVE_INFINITY)).toBe('Infinity %');
  });

  it('keeps bigint values exact and does not imply precision beyond unsafe numbers', () => {
    expect(formatNumber(123_456_789_012_345_678_901n)).toBe('123 456 789 012 345 678 901');
    expect(formatNumber(9_007_199_254_740_993n)).toBe('9 007 199 254 740 993');
    expect(formatNumber(9_007_199_254_740_993)).toBe('9 007 199 254 740 992');
  });

  it('formats integer-cent euros exactly and rejects unsafe or fractional number cents', () => {
    expect(formatEurCents(123_456_789)).toBe('1 234 567,89 €');
    expect(formatEurCents(-123_456_789n)).toBe('-1 234 567,89 €');
    expect(formatEurCents(9_007_199_254_740_993n)).toBe('90 071 992 547 409,93 €');
    expect(() => formatEurCents(9_007_199_254_740_992)).toThrow(RangeError);
    expect(() => formatEurCents(1.5)).toThrow(RangeError);
    expect(() => formatEurCents(Number.NaN)).toThrow(RangeError);
  });

  it('promotes compact values at rounded magnitude boundaries', () => {
    expect(formatCompactNumber(999_949)).toBe('999,9 k');
    expect(formatCompactNumber(999_950)).toBe('1 M');
    expect(formatCompactNumber(-999_950)).toBe('-1 M');
    expect(formatCompactNumber(1_234_567_890_123n)).toBe('1,2 T');
    expect(formatCompactNumber(999_999n)).toBe('1 M');
  });

  it('can compact exact bigint values and falls back to exact grouping beyond known suffixes', () => {
    expect(formatCompactNumber(123_456_789_012_345_678_901n)).toBe('123,5 E');
    expect(formatCompactNumber(10n ** 33n)).toBe('1 000 000 000 000 000 000 000 000 000 000 000');
  });
});
