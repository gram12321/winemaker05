import { createCompanyState } from '../../src/game/core/CompanyState';
import type { CalendarRules, GameDate } from '../../src/game/calendar/Calendar';

/** Fixtures use the current creator, never an obsolete calendar-only save. */
export function companyStateAt(date: GameDate = { year: 1, season: 1, week: 1 }, rules: CalendarRules = { weeksPerSeason: 12, seasonsPerYear: 4 }) {
  const created = createCompanyState({ initialDate: date, rules });
  if (created.kind !== 'created') throw new Error(created.reasons.join(' '));
  return created.state;
}
