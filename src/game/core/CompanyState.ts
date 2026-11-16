import { readCalendar, type CalendarRules, type CalendarState, type GameDate } from '../calendar/Calendar';

/** The company's domain-owned state, deeply readonly at the public boundary. */
export interface CompanyState {
  readonly calendar: CalendarState;
}

export interface NewCompanyInput {
  readonly rules: CalendarRules;
  readonly initialDate: GameDate;
}

export type CompanyStateResult =
  | { readonly kind: 'created'; readonly state: CompanyState }
  | { readonly kind: 'rejected'; readonly reasons: readonly string[] };

export type CompanyStateReadResult =
  | { readonly kind: 'valid'; readonly state: CompanyState }
  | { readonly kind: 'invalid'; readonly reasons: readonly string[] };

/** Validate and copy a snapshot at the authority boundary, preserving invalid input. */
export function readCompanyState(value: unknown): CompanyStateReadResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { kind: 'invalid', reasons: Object.freeze(['Company state must be an object.']) };
  }
  const input = value as Record<string, unknown>;
  const extraFields = Object.keys(input).filter((key) => key !== 'calendar').sort();
  if (extraFields.length > 0) {
    return {
      kind: 'invalid',
      reasons: Object.freeze([`Unrecognized company state fields: ${extraFields.join(', ')}.`]),
    };
  }
  const calendar = readCalendar(input.calendar);
  if (calendar.kind === 'invalid') return calendar;
  return { kind: 'valid', state: Object.freeze({ calendar: calendar.calendar }) };
}

/** Create a company from an explicitly configured and validated initial date. */
export function createCompanyState(input: NewCompanyInput): CompanyStateResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { kind: 'rejected', reasons: Object.freeze(['Company configuration must be an object.']) };
  }

  const result = readCompanyState({ calendar: { rules: input.rules, date: input.initialDate } });
  if (result.kind === 'invalid') {
    return { kind: 'rejected', reasons: result.reasons };
  }
  return { kind: 'created', state: result.state };
}
