import type { FinanceState, Posting } from './types';
import { failure, success, type RuleResult } from '../core/Numbers';

export const WEEKLY_WAGE_PER_WORKER_CENTS = 2_000;

/** Cash and the dated posting are one domain result, composed into one commit. */
export function postMoney(state: FinanceState, posting: Posting): RuleResult<FinanceState> {
  const cashCents = state.cashCents + posting.amountCents;
  if (!Number.isSafeInteger(posting.amountCents) || !Number.isSafeInteger(cashCents)) return failure('The payment exceeds supported currency precision.');
  if (cashCents < 0) return failure('Not enough company cash.');
  if (state.postings.some(p => p.id === posting.id)) return failure('This payment has already been posted.');
  return success({ ...state, cashCents, postings: [...state.postings, posting] });
}

/** Wages precede contracts. Unpaid wages persist; borrowing is never automatic. */
export function payWeeklyWages(state: FinanceState, staffCount: number, week: number): FinanceState {
  const due = state.wageArrearsCents + staffCount * WEEKLY_WAGE_PER_WORKER_CENTS;
  const paid = Math.min(state.cashCents, due);
  const posted = paid ? postMoney(state, { id: `wages-${week}`, week, amountCents: -paid, category: 'wages', description: `Week ${week} staff wages${paid < due ? ' (partial)' : ''}` }) : success(state);
  if (!posted.ok) throw new Error(posted.reason);
  return { ...posted.value, wageArrearsCents: due - paid };
}
