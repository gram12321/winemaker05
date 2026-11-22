import type { GrapeId } from '../vineyard/types';
export type BuyerId = 'local-merchant' | 'restaurant' | 'collector';
export interface Customer {
  readonly id: BuyerId;
  readonly relationship: number;
  readonly bottlesBought: number;
}
export interface WineContract {
  readonly id: string;
  readonly buyerId: BuyerId;
  readonly grapeId: GrapeId | null;
  readonly bottles: number;
  readonly minimumStructure: number;
  readonly minimumTaste: number;
  readonly minimumAgeDays: number;
  readonly pricePerBottleCents: number;
  readonly dueWeek: number;
  readonly status: 'offered' | 'accepted' | 'fulfilled' | 'expired' | 'defaulted';
}
export interface Sale {
  readonly id: string;
  readonly week: number;
  readonly lotId: string;
  readonly buyerId: BuyerId;
  readonly bottles: number;
  readonly revenueCents: number;
  readonly contractId: string | null;
}
export interface CommercialState {
  readonly customers: readonly Customer[];
  readonly contracts: readonly WineContract[];
  readonly sales: readonly Sale[];
}
