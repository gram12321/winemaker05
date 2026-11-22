export interface Posting {
  readonly id: string;
  readonly week: number;
  readonly amountCents: number;
  readonly category: 'capital' | 'land' | 'equipment' | 'processing' | 'sale' | 'contract' | 'wages';
  readonly description: string;
}
export interface FinanceState {
  readonly cashCents: number;
  readonly wageArrearsCents: number;
  readonly postings: readonly Posting[];
}
