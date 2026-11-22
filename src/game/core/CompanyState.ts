import { readCalendar, type CalendarRules, type CalendarState, type GameDate } from '../calendar/Calendar';
import type { EstateState } from '../vineyard/types';
import type { WineryState } from '../wine/types';
import type { InventoryState } from '../inventory/types';
import type { EquipmentState } from '../equipment/types';
import type { FinanceState } from '../finance/types';
import type { WorkState } from '../work/types';
import type { CommercialState } from '../commercial/types';
import { frozenCopy } from './Snapshots';
import { validateGameplayState } from './SnapshotValidation';

/** The company's domain-owned state, deeply readonly at the public boundary. */
export interface CompanyState {
  readonly calendar: CalendarState;
  readonly week: number;
  readonly sequence: number;
  readonly estate: EstateState;
  readonly winery: WineryState;
  readonly inventory: InventoryState;
  readonly equipment: EquipmentState;
  readonly finance: FinanceState;
  readonly work: WorkState;
  readonly commercial: CommercialState;
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
  const extraFields = Object.keys(input).filter((key) => !['calendar', 'week', 'sequence', 'estate', 'winery', 'inventory', 'equipment', 'finance', 'work', 'commercial'].includes(key)).sort();
  if (extraFields.length > 0) {
    return {
      kind: 'invalid',
      reasons: Object.freeze([`Unrecognized company state fields: ${extraFields.join(', ')}.`]),
    };
  }
  const calendar = readCalendar(input.calendar);
  if (calendar.kind === 'invalid') return calendar;
  const reasons = validateGameplayState(input);
  if (reasons.length) return { kind: 'invalid', reasons: Object.freeze(reasons) };
  return { kind: 'valid', state: frozenCopy({ ...input, calendar: calendar.calendar } as unknown as CompanyState) };
}

/** Create a company from an explicitly configured and validated initial date. */
export function createCompanyState(input: NewCompanyInput): CompanyStateResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { kind: 'rejected', reasons: Object.freeze(['Company configuration must be an object.']) };
  }

  const result = readCompanyState({
    calendar: { rules: input.rules, date: input.initialDate },
    ...initialGameplay(),
  });
  if (result.kind === 'invalid') {
    return { kind: 'rejected', reasons: result.reasons };
  }
  return { kind: 'created', state: result.state };
}

/** Current starting scenario. Balance values are provisional 05 content. */
export function initialGameplay(): Omit<CompanyState, 'calendar'> {
  return {
    week: 0, sequence: 1,
    estate: { vineyards: [], weather: { temperatureC: 16, rainMm: 12, humidity: 0.5 } },
    winery: { lots: [], archivedLots: [] }, inventory: { holdings: [], reservations: [] },
    equipment: { vessels: [{ id: 'starter-tank', name: 'Estate steel tank', material: 'steel', capacityMl: 2_000_000, condition: 1, uses: 0 }], cellarTemperatureC: 14 },
    finance: { cashCents: 12_000_000, wageArrearsCents: 0, postings: [{ id: 'founding-capital', week: 0, amountCents: 12_000_000, category: 'capital', description: 'Founding capital' }] },
    work: { staff: [
      { id: 'worker-1', name: 'Alex', kgPerWeek: 600, experience: 0 },
      { id: 'worker-2', name: 'Sam', kgPerWeek: 600, experience: 0 },
    ], activities: [] },
    commercial: { customers: [
      { id: 'local-merchant', relationship: 0.5, bottlesBought: 0 },
      { id: 'restaurant', relationship: 0.5, bottlesBought: 0 },
      { id: 'collector', relationship: 0.5, bottlesBought: 0 },
    ], contracts: [], sales: [] },
  };
}
