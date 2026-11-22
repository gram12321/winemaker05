import type { CompanyState } from '../core/CompanyState';
import type { GameCommand } from '../core/Commands';
import { decideCommand } from '../core/decideCommand';

export interface ActionPreview { readonly allowed: boolean; readonly reasons: readonly string[] }

export interface PressOutcome {
  readonly juiceMl: number;
  readonly extractedPhenolics: number;
  readonly greenCharacterAdded: number;
  readonly oxygenExposureAdded: number;
}

export type PressActionPreview =
  | { readonly allowed: true; readonly reasons: readonly []; readonly outcome: PressOutcome }
  | { readonly allowed: false; readonly reasons: readonly string[]; readonly outcome: null };

/** Evaluate the exact pure command, discard its candidate, and retain no aliases. */
export function previewCommand(state: CompanyState, command: GameCommand): ActionPreview {
  const decision = decideCommand(state, command);
  return decision.kind === 'accepted' ? { allowed: true, reasons: [] } : { allowed: false, reasons: decision.reasons };
}

export function pressDestinations(state: CompanyState, lotId: string, intensity: number, destem: boolean, skinContact: boolean): readonly {
  readonly vessel: CompanyState['equipment']['vessels'][number];
  readonly preview: PressActionPreview;
}[] {
  return state.equipment.vessels.map(vessel => {
    const command = { type: 'wine.press' as const, lotId, vesselId: vessel.id, intensity, destem, skinContact };
    const decision = decideCommand(state, command);
    if (decision.kind === 'rejected') {
      return { vessel, preview: { allowed: false, reasons: decision.reasons, outcome: null } as const };
    }

    const beforeLot = state.winery.lots.find(lot => lot.id === lotId);
    const afterLot = decision.next.winery.lots.find(lot => lot.id === lotId);
    const holding = decision.next.inventory.holdings.find(item => item.lotId === lotId);
    if (!beforeLot || !afterLot || !holding || holding.unit !== 'ml') {
      throw new RangeError('Accepted press preview did not retain its wine and juice holding.');
    }

    return {
      vessel,
      preview: {
        allowed: true,
        reasons: [],
        outcome: {
          juiceMl: holding.quantity,
          extractedPhenolics: afterLot.physical.phenolics - beforeLot.physical.phenolics,
          greenCharacterAdded: afterLot.physical.greenCharacter - beforeLot.physical.greenCharacter,
          oxygenExposureAdded: afterLot.physical.oxygenExposure - beforeLot.physical.oxygenExposure,
        },
      } as const,
    };
  });
}

export function transferDestinations(state: CompanyState, lotId: string) {
  return state.equipment.vessels.map(vessel => ({ vessel, preview: previewCommand(state, { type: 'wine.transfer', lotId, vesselId: vessel.id }) }));
}

export function splitDestinations(state: CompanyState, lotId: string, quantity: number) {
  const holding = state.inventory.holdings.find(h => h.lotId === lotId);
  const destinations = holding?.unit === 'ml' ? state.equipment.vessels : [null];
  return destinations.map(vessel => ({ vessel, preview: previewCommand(state, { type: 'wine.split', lotId, quantity, vesselId: vessel?.id ?? null }) }));
}

export function blendDestinations(state: CompanyState, lotIds: readonly string[], name: string) {
  return state.equipment.vessels.map(vessel => ({ vessel, preview: previewCommand(state, { type: 'wine.blend', lotIds, vesselId: vessel.id, name }) }));
}

export function contractFulfillment(state: CompanyState, contractId: string): ActionPreview {
  return previewCommand(state, { type: 'contract.fulfill', contractId });
}
