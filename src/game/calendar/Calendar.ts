/** Calendar sizes are supplied by the caller; 05 has no selected defaults yet. */
export interface CalendarRules {
  readonly weeksPerSeason: number;
  readonly seasonsPerYear: number;
}

/** Season and week are one-based. A year is any safe integer. */
export interface GameDate {
  readonly year: number;
  readonly season: number;
  readonly week: number;
}

export interface CalendarState {
  readonly rules: CalendarRules;
  readonly date: GameDate;
}

export interface CalendarInterval {
  readonly from: GameDate;
  readonly to: GameDate;
  readonly crossedSeason: boolean;
  readonly crossedYear: boolean;
}

type CalendarValidation =
  | { readonly kind: 'valid'; readonly calendar: CalendarState }
  | { readonly kind: 'invalid'; readonly reasons: readonly string[] };

export type CalendarAdvance =
  | {
      readonly kind: 'planned';
      readonly next: CalendarState;
      readonly interval: CalendarInterval;
    }
  | { readonly kind: 'rejected'; readonly reasons: readonly string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function unrecognizedFields(value: Record<string, unknown>, allowed: readonly string[]): string[] {
  return Object.keys(value).filter((key) => !allowed.includes(key)).sort();
}

function copyDate(date: GameDate): GameDate {
  return Object.freeze({ year: date.year, season: date.season, week: date.week });
}

function copyCalendar(rules: CalendarRules, date: GameDate): CalendarState {
  return Object.freeze({
    rules: Object.freeze({
      weeksPerSeason: rules.weeksPerSeason,
      seasonsPerYear: rules.seasonsPerYear,
    }),
    date: copyDate(date),
  });
}

/** Validate and copy calendar data, including data from an untrusted boundary. */
export function readCalendar(value: unknown): CalendarValidation {
  if (!isRecord(value)) {
    return { kind: 'invalid', reasons: Object.freeze(['Calendar must be an object.']) };
  }

  const reasons: string[] = [];
  const extraCalendarFields = unrecognizedFields(value, ['rules', 'date']);
  if (extraCalendarFields.length > 0) {
    reasons.push(`Unrecognized calendar fields: ${extraCalendarFields.join(', ')}.`);
  }
  const { rules, date } = value;
  if (!isRecord(rules)) reasons.push('Calendar rules must be an object.');
  if (!isRecord(date)) reasons.push('Calendar date must be an object.');
  if (!isRecord(rules) || !isRecord(date)) {
    return { kind: 'invalid', reasons: Object.freeze(reasons) };
  }

  const { weeksPerSeason, seasonsPerYear } = rules;
  const { year, season, week } = date;
  const extraRuleFields = unrecognizedFields(rules, ['weeksPerSeason', 'seasonsPerYear']);
  const extraDateFields = unrecognizedFields(date, ['year', 'season', 'week']);
  if (extraRuleFields.length > 0) {
    reasons.push(`Unrecognized calendar rule fields: ${extraRuleFields.join(', ')}.`);
  }
  if (extraDateFields.length > 0) {
    reasons.push(`Unrecognized calendar date fields: ${extraDateFields.join(', ')}.`);
  }
  if (!isPositiveSafeInteger(weeksPerSeason)) {
    reasons.push('Weeks per season must be a positive safe integer.');
  }
  if (!isPositiveSafeInteger(seasonsPerYear)) {
    reasons.push('Seasons per year must be a positive safe integer.');
  }
  if (typeof year !== 'number' || !Number.isSafeInteger(year)) {
    reasons.push('Year must be a safe integer.');
  }
  if (!isPositiveSafeInteger(season)) {
    reasons.push('Season must be a positive safe integer.');
  } else if (isPositiveSafeInteger(seasonsPerYear) && season > seasonsPerYear) {
    reasons.push('Season exceeds the configured seasons per year.');
  }
  if (!isPositiveSafeInteger(week)) {
    reasons.push('Week must be a positive safe integer.');
  } else if (isPositiveSafeInteger(weeksPerSeason) && week > weeksPerSeason) {
    reasons.push('Week exceeds the configured weeks per season.');
  }

  if (
    reasons.length > 0 ||
    !isPositiveSafeInteger(weeksPerSeason) ||
    !isPositiveSafeInteger(seasonsPerYear) ||
    typeof year !== 'number' ||
    !Number.isSafeInteger(year) ||
    !isPositiveSafeInteger(season) ||
    !isPositiveSafeInteger(week)
  ) {
    return { kind: 'invalid', reasons: Object.freeze(reasons) };
  }

  return {
    kind: 'valid',
    calendar: copyCalendar({ weeksPerSeason, seasonsPerYear }, { year, season, week }),
  };
}

/** Plan a single week without changing the supplied calendar. */
export function planCalendarAdvance(value: unknown): CalendarAdvance {
  const validation = readCalendar(value);
  if (validation.kind === 'invalid') {
    return { kind: 'rejected', reasons: validation.reasons };
  }

  const { rules, date } = validation.calendar;
  const crossedSeason = date.week === rules.weeksPerSeason;
  const crossedYear = crossedSeason && date.season === rules.seasonsPerYear;
  if (crossedYear && date.year === Number.MAX_SAFE_INTEGER) {
    return { kind: 'rejected', reasons: Object.freeze(['Advancing would exceed the supported year.']) };
  }

  const to: GameDate = {
    year: crossedYear ? date.year + 1 : date.year,
    season: crossedYear ? 1 : crossedSeason ? date.season + 1 : date.season,
    week: crossedSeason ? 1 : date.week + 1,
  };
  const next = copyCalendar(rules, to);
  return {
    kind: 'planned',
    next,
    interval: Object.freeze({
      from: copyDate(date),
      to: copyDate(next.date),
      crossedSeason,
      crossedYear,
    }),
  };
}
