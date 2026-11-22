import { describe, expect, it } from 'vitest';
import { availableQuantity, consume, liquidDestinationIssue } from '../../src/game/inventory/Rules';
import type { InventoryState } from '../../src/game/inventory/types';

describe('inventory allocation and reservations', () => {
  it('protects other commitments while allowing a contract to consume its own reservation', () => {
    const state: InventoryState = { holdings: [{ lotId: 'bottles', quantity: 100, unit: 'bottle', location: 'cellar', vesselId: null }], reservations: [{ contractId: 'contract-a', lotId: 'bottles', bottles: 30 }, { contractId: 'contract-b', lotId: 'bottles', bottles: 20 }] };
    expect(availableQuantity(state, 'bottles')).toBe(50);
    expect(availableQuantity(state, 'bottles', 'contract-a')).toBe(80);
    expect(consume(state, 'bottles', 60).ok).toBe(false);
    const delivery = consume(state, 'bottles', 60, 'contract-a');
    expect(delivery.ok).toBe(true);
    if (delivery.ok) expect(delivery.value.holdings[0].quantity).toBe(40);
    expect(state.holdings[0].quantity).toBe(100);
  });

  it('requires an explicit blend before two liquid states can share a vessel', () => {
    const state: InventoryState = { holdings: [{ lotId: 'lot-a', quantity: 1000, unit: 'ml', location: 'vessel', vesselId: 'tank-a' }], reservations: [] };
    expect(liquidDestinationIssue(state, 'tank-a', 500, 1000)).toContain('Blend explicitly');
    expect(liquidDestinationIssue(state, 'tank-a', 1500, 2000, ['lot-a'])).toBeNull();
    expect(liquidDestinationIssue(state, 'tank-b', 2001, 2000)).toContain('capacity');
    expect(liquidDestinationIssue(state, 'tank-b', 0, 2000)).not.toBeNull();
  });

  it('removes empty holdings and rejects unsupported quantity operations', () => {
    const state: InventoryState = { holdings: [{ lotId: 'grapes', quantity: 1000, unit: 'g', location: 'harvest', vesselId: null }], reservations: [] };
    expect(consume(state, 'grapes', 1001).ok).toBe(false);
    expect(consume(state, 'grapes', -1).ok).toBe(false);
    expect(consume(state, 'grapes', 1.5).ok).toBe(false);
    const consumed = consume(state, 'grapes', 1000);
    expect(consumed.ok && consumed.value.holdings).toEqual([]);
  });
});
