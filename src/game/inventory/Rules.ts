import type { Holding, InventoryState } from './types';
import { failure, success, type RuleResult } from '../core/Numbers';

export const HARVEST_STORAGE_CAPACITY_G = 12_000_000;

export function reservedBottles(state: InventoryState, lotId: string, exceptContractId?: string): number {
  return state.reservations.filter(r => r.lotId === lotId && r.contractId !== exceptContractId).reduce((sum, r) => sum + r.bottles, 0);
}

export function availableQuantity(state: InventoryState, lotId: string, exceptContractId?: string): number {
  const item = state.holdings.find(h => h.lotId === lotId);
  return item ? item.quantity - (item.unit === 'bottle' ? reservedBottles(state, lotId, exceptContractId) : 0) : 0;
}

export function harvestStorageFreeG(state: InventoryState): number {
  return Math.max(0, HARVEST_STORAGE_CAPACITY_G - state.holdings.filter(h => h.unit === 'g').reduce((sum, h) => sum + h.quantity, 0));
}

/** A vessel contains one coherent material state; combining lots is explicit. */
export function liquidDestinationIssue(state: InventoryState, vesselId: string, quantityMl: number, availableMl: number, removedLotIds: readonly string[] = []): string | null {
  if (state.holdings.some(holding => holding.vesselId === vesselId && !removedLotIds.includes(holding.lotId))) return 'The destination holds another lot. Blend explicitly or empty the vessel first.';
  if (!Number.isSafeInteger(quantityMl) || quantityMl <= 0 || quantityMl > availableMl) return 'The destination vessel lacks capacity for this volume.';
  return null;
}

/** Replace/remove one holding. Zero holdings never survive into current state. */
export function setHolding(state: InventoryState, item: Holding): InventoryState {
  const rest = state.holdings.filter(h => h.lotId !== item.lotId);
  return { ...state, holdings: item.quantity > 0 ? [...rest, item] : rest };
}

export function consume(state: InventoryState, lotId: string, quantity: number, exceptContractId?: string): RuleResult<InventoryState> {
  const item = state.holdings.find(h => h.lotId === lotId);
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || !item || quantity > availableQuantity(state, lotId, exceptContractId)) return failure('The requested quantity is unavailable or reserved.');
  return success(setHolding(state, { ...item, quantity: item.quantity - quantity }));
}
