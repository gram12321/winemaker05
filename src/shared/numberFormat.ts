/**
 * Deterministic player-facing number formatting for the game's UI.
 *
 * The locale is fixed to de-DE for comma decimals. Its locale grouping mark is
 * rendered as an ordinary space so output does not depend on the host locale
 * or ICU's choice of space character.
 */

export type NumberFormatValue = number | bigint;

export interface NumberFormatOptions {
  /** Minimum digits after the decimal comma. */
  minimumFractionDigits?: number;
  /** Preferred maximum digits after the decimal comma. */
  maximumFractionDigits?: number;
  /** Render exactly this many digits after the decimal comma. */
  fractionDigits?: number;
  /** Add precision for small non-zero numbers; defaults on unless max/fixed precision is explicit. */
  adaptivePrecision?: boolean;
  /** Hard ceiling used when adaptive precision is enabled. Defaults to 12. */
  maxAdaptiveFractionDigits?: number;
  /** Use compact magnitude suffixes when the value is large enough. */
  compact?: boolean;
}

interface FractionDigits {
  minimum: number;
  maximum: number;
  adaptive: boolean;
  adaptiveMaximum: number;
  fixed: boolean;
}

interface CompactMagnitude {
  numberDivisor: number;
  bigintDivisor: bigint;
  suffix: string;
}

const NUMBER_LOCALE = 'de-DE';
const DEFAULT_MAX_FRACTION_DIGITS = 2;
const DEFAULT_COMPACT_MAX_FRACTION_DIGITS = 1;
const DEFAULT_ADAPTIVE_MAX_FRACTION_DIGITS = 12;
const MAX_FRACTION_DIGITS = 100;

const COMPACT_MAGNITUDES: readonly CompactMagnitude[] = [
  { numberDivisor: 1e3, bigintDivisor: 1_000n, suffix: 'k' },
  { numberDivisor: 1e6, bigintDivisor: 1_000_000n, suffix: 'M' },
  { numberDivisor: 1e9, bigintDivisor: 1_000_000_000n, suffix: 'B' },
  { numberDivisor: 1e12, bigintDivisor: 1_000_000_000_000n, suffix: 'T' },
  { numberDivisor: 1e15, bigintDivisor: 1_000_000_000_000_000n, suffix: 'P' },
  { numberDivisor: 1e18, bigintDivisor: 1_000_000_000_000_000_000n, suffix: 'E' },
  { numberDivisor: 1e21, bigintDivisor: 1_000_000_000_000_000_000_000n, suffix: 'Z' },
  { numberDivisor: 1e24, bigintDivisor: 1_000_000_000_000_000_000_000_000n, suffix: 'Y' },
  { numberDivisor: 1e27, bigintDivisor: 1_000_000_000_000_000_000_000_000_000n, suffix: 'R' },
  { numberDivisor: 1e30, bigintDivisor: 1_000_000_000_000_000_000_000_000_000_000n, suffix: 'Q' },
];

const decimalFormatters = new Map<string, Intl.NumberFormat>();

function assertFractionDigits(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0 || value > MAX_FRACTION_DIGITS) {
    throw new RangeError(`${name} must be an integer from 0 to ${MAX_FRACTION_DIGITS}.`);
  }
}

function resolveFractionDigits(options: NumberFormatOptions): FractionDigits {
  const hasFixedDigits = options.fractionDigits !== undefined;
  if (hasFixedDigits && (options.minimumFractionDigits !== undefined || options.maximumFractionDigits !== undefined)) {
    throw new RangeError('fractionDigits cannot be combined with minimumFractionDigits or maximumFractionDigits.');
  }

  if (hasFixedDigits) {
    const fixed = options.fractionDigits!;
    assertFractionDigits(fixed, 'fractionDigits');
    return { minimum: fixed, maximum: fixed, adaptive: false, adaptiveMaximum: fixed, fixed: true };
  }

  const minimum = options.minimumFractionDigits ?? 0;
  assertFractionDigits(minimum, 'minimumFractionDigits');

  const defaultMaximum = options.compact ? DEFAULT_COMPACT_MAX_FRACTION_DIGITS : DEFAULT_MAX_FRACTION_DIGITS;
  const maximum = options.maximumFractionDigits ?? Math.max(defaultMaximum, minimum);
  assertFractionDigits(maximum, 'maximumFractionDigits');
  if (minimum > maximum) {
    throw new RangeError('minimumFractionDigits cannot exceed maximumFractionDigits.');
  }

  const adaptive = options.adaptivePrecision
    ?? (options.maximumFractionDigits === undefined);
  const adaptiveMaximum = options.maxAdaptiveFractionDigits
    ?? Math.max(DEFAULT_ADAPTIVE_MAX_FRACTION_DIGITS, maximum);
  assertFractionDigits(adaptiveMaximum, 'maxAdaptiveFractionDigits');
  if (adaptiveMaximum < maximum) {
    throw new RangeError('maxAdaptiveFractionDigits cannot be less than maximumFractionDigits.');
  }

  return { minimum, maximum, adaptive, adaptiveMaximum, fixed: false };
}

function getDecimalFormatter(minimum: number, maximum: number): Intl.NumberFormat {
  const key = `${minimum}:${maximum}`;
  let formatter = decimalFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(NUMBER_LOCALE, {
      style: 'decimal',
      useGrouping: true,
      minimumFractionDigits: minimum,
      maximumFractionDigits: maximum,
    });
    decimalFormatters.set(key, formatter);
  }
  return formatter;
}

function renderParts(parts: Intl.NumberFormatPart[]): string {
  return parts.map(part => {
    if (part.type === 'group') return ' ';
    if (part.type === 'decimal') return ',';
    return part.value;
  }).join('');
}

function renderNumber(value: number, minimum: number, maximum: number): string {
  const normalized = Object.is(value, -0) ? 0 : value;
  return renderParts(getDecimalFormatter(minimum, maximum).formatToParts(normalized));
}

function renderedPartsAreZero(parts: Intl.NumberFormatPart[]): boolean {
  const digits = parts.filter(part => part.type === 'integer' || part.type === 'fraction');
  return digits.length > 0 && digits.every(part => /^0+$/.test(part.value));
}

function firstNonZeroFractionDigits(value: number): number {
  let scaled = Math.abs(value);
  let digits = 0;
  while (scaled < 1 && digits < MAX_FRACTION_DIGITS) {
    scaled *= 10;
    digits += 1;
  }
  return digits;
}

function roundedZeroMarker(digits: number, negative: boolean): string {
  const threshold = digits === 0 ? '0,5' : `0,${'0'.repeat(digits)}5`;
  return negative ? `>-${threshold}` : `<${threshold}`;
}

function formatFiniteNumber(value: number, digits: FractionDigits): string {
  if (Object.is(value, -0)) return renderNumber(0, digits.minimum, digits.maximum);
  if (value === 0) return renderNumber(value, digits.minimum, digits.maximum);

  const negative = value < 0;
  let maximum = digits.maximum;
  if (digits.adaptive && Math.abs(value) < 1) {
    maximum = Math.min(digits.adaptiveMaximum, Math.max(maximum, firstNonZeroFractionDigits(value)));
  }

  const parts = getDecimalFormatter(digits.minimum, maximum).formatToParts(value);
  if (!digits.fixed && renderedPartsAreZero(parts)) {
    return roundedZeroMarker(maximum, negative);
  }
  return renderParts(parts);
}

function groupIntegerDigits(digits: string): string {
  return digits.replace(/\B(?=(?:\d{3})+(?!\d))/g, ' ');
}

function formatBigInt(value: bigint, minimumFractionDigits: number): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = groupIntegerDigits(absolute.toString());
  const fraction = minimumFractionDigits === 0 ? '' : `,${'0'.repeat(minimumFractionDigits)}`;
  return `${negative ? '-' : ''}${whole}${fraction}`;
}

function powerOfTen(exponent: number): bigint {
  return 10n ** BigInt(exponent);
}

function formatScaledBigInt(value: bigint, fractionDigits: FractionDigits): string {
  const maximum = fractionDigits.maximum;
  const scaled = value.toString().padStart(maximum + 1, '0');
  const wholeDigits = maximum === 0 ? scaled : scaled.slice(0, -maximum);
  const fractionalDigits = maximum === 0 ? '' : scaled.slice(-maximum);
  const trimmedFraction = fractionalDigits.replace(/0+$/, '');
  const normalizedFraction = trimmedFraction.padEnd(fractionDigits.minimum, '0');
  const whole = groupIntegerDigits(BigInt(wholeDigits).toString());
  return `${whole}${normalizedFraction ? `,${normalizedFraction}` : ''}`;
}
function compactIndexForNumber(value: number): number {
  let index = -1;
  for (let current = 0; current < COMPACT_MAGNITUDES.length; current += 1) {
    if (value < COMPACT_MAGNITUDES[current].numberDivisor) break;
    index = current;
  }
  return index;
}

function compactIndexForBigInt(value: bigint): number {
  let index = -1;
  for (let current = 0; current < COMPACT_MAGNITUDES.length; current += 1) {
    if (value < COMPACT_MAGNITUDES[current].bigintDivisor) break;
    index = current;
  }
  return index;
}

function formatCompactNumberValue(value: number, digits: FractionDigits): string {
  const absolute = Math.abs(value);
  const index = compactIndexForNumber(absolute);
  if (index < 0 || absolute >= COMPACT_MAGNITUDES.at(-1)!.numberDivisor * 1000) {
    return formatFiniteNumber(value, digits);
  }

  let current = index;
  while (current < COMPACT_MAGNITUDES.length) {
    const magnitude = COMPACT_MAGNITUDES[current];
    const scaled = value / magnitude.numberDivisor;
    const parts = getDecimalFormatter(digits.minimum, digits.maximum).formatToParts(scaled);
    const roundedInteger = Number(parts
      .filter(part => part.type === 'integer')
      .map(part => part.value)
      .join(''));

    if (roundedInteger >= 1000) {
      if (current === COMPACT_MAGNITUDES.length - 1) return formatFiniteNumber(value, digits);
      current += 1;
      continue;
    }

    return `${renderParts(parts)} ${magnitude.suffix}`;
  }

  return formatFiniteNumber(value, digits);
}

function formatCompactBigInt(value: bigint, digits: FractionDigits): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const index = compactIndexForBigInt(absolute);
  const lastMagnitude = COMPACT_MAGNITUDES.at(-1)!;
  if (index < 0 || absolute >= lastMagnitude.bigintDivisor * 1000n) {
    return formatBigInt(value, digits.minimum);
  }

  let current = index;
  const scale = powerOfTen(digits.maximum);
  while (current < COMPACT_MAGNITUDES.length) {
    const magnitude = COMPACT_MAGNITUDES[current];
    const roundedScaled = (absolute * scale + magnitude.bigintDivisor / 2n) / magnitude.bigintDivisor;
    if (roundedScaled >= 1000n * scale) {
      if (current === COMPACT_MAGNITUDES.length - 1) return formatBigInt(value, digits.minimum);
      current += 1;
      continue;
    }

    const rendered = formatScaledBigInt(roundedScaled, digits);
    return `${negative ? '-' : ''}${rendered} ${magnitude.suffix}`;
  }

  return formatBigInt(value, digits.minimum);
}

function withDefaultPrecision(options: NumberFormatOptions, maximumFractionDigits: number): NumberFormatOptions {
  if (options.fractionDigits !== undefined) return options;

  return {
    ...options,
    maximumFractionDigits: options.maximumFractionDigits
      ?? Math.max(maximumFractionDigits, options.minimumFractionDigits ?? 0),
    adaptivePrecision: options.adaptivePrecision
      ?? (options.maximumFractionDigits === undefined && options.fractionDigits === undefined),
  };
}

/**
 * Formats a finite number or exact bigint with fixed European separators.
 * Unsafe integer numbers remain numbers as supplied; use bigint for exact large
 * integers. Non-finite numbers render as NaN, Infinity, or -Infinity.
 */
export function formatNumber(value: NumberFormatValue, options: NumberFormatOptions = {}): string {
  const digits = resolveFractionDigits(options);
  if (typeof value === 'number' && !Number.isFinite(value)) return String(value);

  if (typeof value === 'bigint') {
    return options.compact ? formatCompactBigInt(value, digits) : formatBigInt(value, digits.minimum);
  }

  if (options.compact) return formatCompactNumberValue(value, digits);
  return formatFiniteNumber(value, digits);
}

/** Formats an integer count of euro cents exactly, with exactly two decimals. */
export function formatEurCents(cents: bigint | number): string {
  if (typeof cents === 'number' && !Number.isSafeInteger(cents)) {
    throw new RangeError('Numeric euro cents must be a safe integer; use bigint for exact larger amounts.');
  }

  const exactCents = typeof cents === 'bigint' ? cents : BigInt(cents);
  const negative = exactCents < 0n;
  const absolute = negative ? -exactCents : exactCents;
  const euros = groupIntegerDigits((absolute / 100n).toString());
  const fractionalCents = (absolute % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${euros},${fractionalCents} €`;
}

/** Formats a ratio as a ratio (for example, 0.125 becomes 0,125). */
export function formatRatio(value: number, options: NumberFormatOptions = {}): string {
  return formatNumber(value, withDefaultPrecision(options, 4));
}

/** Formats a normalized score as points out of 100 (for example, 0.75 becomes 75/100). */
export function formatScore(scoreRatio: number, options: NumberFormatOptions = {}): string {
  const score = scoreRatio * 100;
  return `${formatNumber(score, withDefaultPrecision(options, 0))}/100`;
}

/** Formats a ratio as a percentage (for example, 0.125 becomes 12,5 %). */
export function formatPercent(ratio: number, options: NumberFormatOptions = {}): string {
  const percentage = ratio * 100;
  return `${formatNumber(percentage, withDefaultPrecision(options, 1))} %`;
}

/** Formats a number using compact k/M/B/T/P/E/Z/Y/R/Q magnitudes where possible. */
export function formatCompactNumber(value: NumberFormatValue, options: Omit<NumberFormatOptions, 'compact'> = {}): string {
  return formatNumber(value, { ...options, compact: true });
}
