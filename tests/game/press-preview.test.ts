import { describe, expect, it } from 'vitest';
import { decideCommand } from '../../src/game/core/decideCommand';
import { pressDestinations } from '../../src/game/queries/ActionPreviews';
import { createHarvestedScenario } from '../helpers/CoreScenario';

describe('press outcome preview', () => {
  it('matches the accepted command result for yield, extraction and oxygen exposure without changing state', () => {
    const { state, lotId } = createHarvestedScenario();
    const original = structuredClone(state);
    const before = state.winery.lots.find(lot => lot.id === lotId)!;
    const outcomes = [];
    for (const intensity of [0, 1]) {
      const command = { type: 'wine.press' as const, lotId, vesselId: 'starter-tank', intensity, destem: true, skinContact: false };
      const preview = pressDestinations(state, lotId, intensity, true, false).find(item => item.vessel.id === command.vesselId)!.preview;
      const decision = decideCommand(state, command);
      expect(preview.allowed).toBe(true);
      expect(decision.kind).toBe('accepted');
      if (!preview.allowed || decision.kind !== 'accepted') throw new Error('Expected press to be available.');
      const after = decision.next.winery.lots.find(lot => lot.id === lotId)!;
      const holding = decision.next.inventory.holdings.find(item => item.lotId === lotId)!;
      expect(preview.outcome.juiceMl).toBe(holding.quantity);
      expect(preview.outcome.extractedPhenolics).toBe(after.physical.phenolics - before.physical.phenolics);
      expect(preview.outcome.oxygenExposureAdded).toBe(after.physical.oxygenExposure - before.physical.oxygenExposure);
      outcomes.push(preview.outcome);
    }
    expect(outcomes[1].juiceMl).toBeGreaterThan(outcomes[0].juiceMl);
    expect(outcomes[1].extractedPhenolics).toBeGreaterThan(outcomes[0].extractedPhenolics);
    expect(outcomes[1].oxygenExposureAdded).toBeGreaterThan(outcomes[0].oxygenExposureAdded);
    expect(state).toEqual(original);
  });

  it('retains the command rejection and does not promise an outcome when pressing is unaffordable', () => {
    const { state, lotId } = createHarvestedScenario();
    const broke = { ...state, finance: { ...state.finance, cashCents: 0 } };
    const command = { type: 'wine.press' as const, lotId, vesselId: 'starter-tank', intensity: 0.5, destem: true, skinContact: false };
    const preview = pressDestinations(broke, lotId, command.intensity, command.destem, command.skinContact).find(item => item.vessel.id === command.vesselId)!.preview;
    const decision = decideCommand(broke, command);
    expect(decision.kind).toBe('rejected');
    if (decision.kind !== 'rejected') throw new Error('Expected press to be rejected.');
    expect(preview).toEqual({ allowed: false, reasons: decision.reasons, outcome: null });
  });
});
