import { describe, expect, it } from 'vitest';
import { readGameCommand } from '../../src/game/core/Commands';

describe('gameplay command boundary', () => {
  it('copies a valid multi-person intent without retaining mutable caller arrays', () => {
    const command = { type: 'harvest.start', vineyardId: 'vineyard-1', kilograms: 350.125, staffIds: ['worker-1', 'worker-2'] };
    const parsed = readGameCommand(command);
    command.staffIds.pop();
    expect(parsed).toEqual({ ...command, staffIds: ['worker-1', 'worker-2'] });
  });

  it.each([
    { type: 'wine.sell', lotId: 'lot-2', buyerId: 'restaurant', bottles: 10, priceCents: 1 },
    { type: 'wine.blend', lotIds: ['lot-1', 'lot-1'], vesselId: 'starter-tank', name: 'Duplicate material' },
    { type: 'wine.bottle', lotId: 'lot-2', bottles: 1.5 },
    { type: 'wine.press', lotId: 'lot-2', vesselId: 'starter-tank', intensity: Number.NaN, destem: true, skinContact: false },
    { type: 'harvest.start', vineyardId: 'vineyard-1', kilograms: 1, staffIds: ['worker-1', 2] },
    { type: 'time.advance', next: { cashCents: 100 } },
    Object.create({ type: 'time.advance' }),
  ])('rejects forged, ambiguous or lossy runtime input %#', command => {
    expect(readGameCommand(command)).toBeNull();
  });

  it('accepts zero as the explicit operation for clearing a contract allocation', () => {
    const command = { type: 'contract.reserve', contractId: 'offer-1', lotId: 'lot-2', bottles: 0 };
    expect(readGameCommand(command)).toEqual(command);
  });
});
