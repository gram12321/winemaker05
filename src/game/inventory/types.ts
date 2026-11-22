/** Integer grams, millilitres or bottles. Form determines the unit. */
export interface Holding {
  readonly lotId: string;
  readonly quantity: number;
  readonly unit: 'g' | 'ml' | 'bottle';
  readonly location: 'harvest' | 'vessel' | 'cellar';
  readonly vesselId: string | null;
}
export interface Reservation {
  readonly contractId: string;
  readonly lotId: string;
  readonly bottles: number;
}
export interface InventoryState {
  readonly holdings: readonly Holding[];
  readonly reservations: readonly Reservation[];
}
