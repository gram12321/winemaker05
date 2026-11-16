import type { GameDate } from '../calendar/Calendar';
import type { CompanyState } from './CompanyState';

export type DomainEvent = {
  readonly type: 'time.advanced';
  readonly from: GameDate;
  readonly to: GameDate;
  readonly crossedSeason: boolean;
  readonly crossedYear: boolean;
};

export type CommandDecision =
  | { readonly kind: 'accepted'; readonly next: CompanyState; readonly events: readonly DomainEvent[] }
  | { readonly kind: 'rejected'; readonly reasons: readonly string[] };
