import type { CompanyState } from '../core/CompanyState';
import type { PhysicalLot } from '../wine/types';
import type { Posting } from '../finance/types';
import { postMoney } from '../finance/Rules';
import { failure, success, type RuleResult } from '../core/Numbers';

/** Cross-domain composition only: each domain retains its own calculations. */
export function recordPayment(state: CompanyState, category: Posting['category'], amountCents: number, description: string): RuleResult<CompanyState> {
  const result = postMoney(state.finance, { id: `posting-${state.sequence}`, week: state.week, category, amountCents, description });
  return result.ok ? success({ ...state, finance: result.value, sequence: state.sequence + 1 }) : failure(result.reason);
}

export function replaceLot(state: CompanyState, lot: PhysicalLot): CompanyState {
  return { ...state, winery: { ...state.winery, lots: [...state.winery.lots.filter(v => v.id !== lot.id), lot] } };
}

export function archiveConsumedLots(state: CompanyState): CompanyState {
  const live = new Set(state.inventory.holdings.map(h => h.lotId));
  return { ...state, winery: {
    lots: state.winery.lots.filter(lot => live.has(lot.id)),
    archivedLots: [...state.winery.archivedLots, ...state.winery.lots.filter(lot => !live.has(lot.id))],
  } };
}

export function traceLot(lot: PhysicalLot, week: number, action: string, detail: string): PhysicalLot {
  return { ...lot, history: [...lot.history, { week, action, detail }] };
}
