import { planCalendarAdvance } from '../calendar/Calendar';
import { readCompanyState, type CompanyState } from '../core/CompanyState';
import type { CommandDecision, DomainEvent } from '../core/Results';

/** Produce an independent candidate and event; the authority decides whether to commit it. */
export function advanceTime(state: CompanyState): CommandDecision {
  const company = readCompanyState(state);
  if (company.kind === 'invalid') return { kind: 'rejected', reasons: company.reasons };
  const planned = planCalendarAdvance(company.state.calendar);
  if (planned.kind === 'rejected') return planned;

  const event: DomainEvent = Object.freeze({ type: 'time.advanced', ...planned.interval });
  return {
    kind: 'accepted',
    next: Object.freeze({ calendar: planned.next }),
    events: Object.freeze([event]),
  };
}
