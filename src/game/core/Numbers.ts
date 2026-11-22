export const clamp = (value: number, low = 0, high = 1): number => Math.max(low, Math.min(high, value));
export const BOTTLE_ML = 750;
export const DAYS_PER_WEEK = 7;
export const MAX_SNAPSHOT_TEXT_LENGTH = 500;
export type RuleResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: string };
export const success = <T>(value: T): RuleResult<T> => ({ ok: true, value });
export const failure = (reason: string): RuleResult<never> => ({ ok: false, reason });
