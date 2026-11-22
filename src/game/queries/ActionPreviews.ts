import type { CompanyState } from '../core/CompanyState';
import type { GameCommand } from '../core/Commands';
import { decideCommand } from '../core/decideCommand';

export interface ActionPreview { readonly allowed: boolean; readonly reasons: readonly string[] }

/** Evaluate the exact pure command, discard its candidate, and retain no aliases. */
export function previewCommand(state: CompanyState, command: GameCommand): ActionPreview {
  const decision = decideCommand(state, command);
  return decision.kind === 'accepted' ? { allowed: true, reasons: [] } : { allowed: false, reasons: decision.reasons };
}

export function pressDestinations(state: CompanyState, lotId: string, intensity: number, destem: boolean, skinContact: boolean) {
  return state.equipment.vessels.map(vessel => ({ vessel, preview: previewCommand(state, { type: 'wine.press', lotId, vesselId: vessel.id, intensity, destem, skinContact }) }));
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
