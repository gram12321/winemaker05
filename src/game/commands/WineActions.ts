import type { CompanyState } from '../core/CompanyState';
import type { GameCommand } from '../core/Commands';
import { BOTTLE_ML, failure, success, type RuleResult } from '../core/Numbers';
import { blendLots, bottleLot, configureFermentation, pressLot, splitLot } from '../wine/Operations';
import { availableQuantity, consume, liquidDestinationIssue, reservedBottles, setHolding } from '../inventory/Rules';
import { isUsableVessel, recordVesselFill, vesselCapacityFreeMl } from '../equipment/Rules';
import { assessWine } from '../evaluation/Assessment';
import { bottlingCostCents, pressingCostCents } from '../finance/ProcessingCosts';
import { archiveConsumedLots, recordPayment, replaceLot, traceLot } from './Transactions';
import { formatNumber } from '../../shared/numberFormat';

export function wineAction(state: CompanyState, command: GameCommand): RuleResult<CompanyState> {
  if (command.type === 'wine.blend') return blendAction(state, command);
  if (!('lotId' in command)) return failure('A wine lot is required.');
  const lot = state.winery.lots.find(v => v.id === command.lotId);
  const holding = state.inventory.holdings.find(v => v.lotId === command.lotId);
  if (!lot || !holding) return failure('The live lot is unavailable.');
  switch (command.type) {
    case 'wine.press': {
      const vessel = state.equipment.vessels.find(v => v.id === command.vesselId);
      if (!vessel || !isUsableVessel(vessel)) return failure('Choose a maintained vessel.');
      const pressed = pressLot(lot, command.intensity, command.destem, command.skinContact, state.week);
      if (!pressed.ok) return pressed;
      const quantity = Math.floor(holding.quantity * pressed.value.mlPerKg / 1000);
      const placement = liquidDestinationIssue(state.inventory, vessel.id, quantity, vesselCapacityFreeMl(vessel, state.inventory.holdings));
      if (placement) return failure(placement);
      const filled = recordVesselFill(vessel);
      if (!filled.ok) return filled;
      const paid = recordPayment(state, 'processing', -pressingCostCents(holding.quantity), `Pressed ${lot.name}`);
      if (!paid.ok) return paid;
      const recorded = traceLot(pressed.value.lot, state.week, 'Juice allocated', `${formatNumber(holding.quantity, { fractionDigits: 0 })} g grapes produced ${formatNumber(quantity, { fractionDigits: 0 })} ml juice in ${vessel.name}.`);
      return success(replaceLot({ ...paid.value, inventory: setHolding(state.inventory, { lotId: lot.id, quantity, unit: 'ml', location: 'vessel', vesselId: vessel.id }), equipment: { ...state.equipment, vessels: state.equipment.vessels.map(v => v.id === vessel.id ? filled.value : v) } }, recorded));
    }
    case 'wine.ferment': {
      const configured = configureFermentation(lot, command, state.week);
      return configured.ok ? success(replaceLot(state, configured.value)) : configured;
    }
    case 'wine.transfer': {
      if (holding.unit !== 'ml') return failure('Only liquid lots can be transferred to a vessel.');
      if (holding.vesselId === command.vesselId) return failure('This lot already occupies that vessel.');
      const vessel = state.equipment.vessels.find(v => v.id === command.vesselId);
      if (!vessel || !isUsableVessel(vessel)) return failure('Choose a maintained destination vessel.');
      const placement = liquidDestinationIssue(state.inventory, vessel.id, holding.quantity, vesselCapacityFreeMl(vessel, state.inventory.holdings));
      if (placement) return failure(placement);
      const filled = recordVesselFill(vessel);
      if (!filled.ok) return filled;
      return success(replaceLot({ ...state, inventory: setHolding(state.inventory, { ...holding, vesselId: vessel.id }), equipment: { ...state.equipment, vessels: state.equipment.vessels.map(v => v.id === vessel.id ? filled.value : v) } }, traceLot(lot, state.week, 'Transferred', `Moved to ${vessel.name}; future development uses its actual environment.`)));
    }
    case 'wine.split': {
      if (command.quantity <= 0 || command.quantity >= holding.quantity || command.quantity > availableQuantity(state.inventory, lot.id)) return failure('Split a positive portion smaller than the available lot.');
      if (reservedBottles(state.inventory, lot.id)) return failure('Release contract reservations before splitting a bottled lot.');
      let equipment = state.equipment;
      if (holding.unit === 'ml') {
        const vessel = state.equipment.vessels.find(v => v.id === command.vesselId);
        if (!vessel || !isUsableVessel(vessel)) return failure('Choose a maintained destination vessel.');
        const placement = liquidDestinationIssue(state.inventory, vessel.id, command.quantity, vesselCapacityFreeMl(vessel, state.inventory.holdings));
        if (placement) return failure(placement);
        const filled = recordVesselFill(vessel);
        if (!filled.ok) return filled;
        equipment = { ...state.equipment, vessels: state.equipment.vessels.map(v => v.id === vessel.id ? filled.value : v) };
      } else if (command.vesselId !== null) return failure('Grapes and bottles do not use a liquid vessel.');
      const child = splitLot(lot, `lot-${state.sequence}`, state.week);
      const remaining = consume(state.inventory, lot.id, command.quantity);
      if (!remaining.ok) return remaining;
      const inventory = setHolding(remaining.value, { ...holding, lotId: child.id, quantity: command.quantity, vesselId: command.vesselId });
      return success(replaceLot(replaceLot({ ...state, sequence: state.sequence + 1, inventory, equipment }, traceLot(lot, state.week, 'Split', `${formatNumber(command.quantity, { fractionDigits: 0 })} ${holding.unit} separated into ${child.id}.`)), traceLot(child, state.week, 'Portion allocated', `${formatNumber(command.quantity, { fractionDigits: 0 })} ${holding.unit} allocated from ${lot.id}.`)));
    }
    case 'wine.bottle': {
      if (command.bottles <= 0 || command.bottles * BOTTLE_ML > holding.quantity) return failure('Choose a whole bottle count within the available wine volume.');
      const assessment = assessWine(lot);
      const bottled = bottleLot(lot, `lot-${state.sequence}`, state.week, { week: state.week, structure: assessment.structure.score, taste: assessment.taste.score, quality: assessment.quality });
      if (!bottled.ok) return bottled;
      const consumed = consume(state.inventory, lot.id, command.bottles * BOTTLE_ML);
      if (!consumed.ok) return consumed;
      const paid = recordPayment({ ...state, sequence: state.sequence + 1 }, 'processing', -bottlingCostCents(command.bottles), `Bottled ${formatNumber(command.bottles, { fractionDigits: 0 })} bottles of ${lot.name}`);
      if (!paid.ok) return paid;
      const inventory = setHolding(consumed.value, { lotId: bottled.value.id, quantity: command.bottles, unit: 'bottle', location: 'cellar', vesselId: null });
      const source = traceLot(lot, state.week, 'Bottling portion', `${formatNumber(command.bottles * BOTTLE_ML, { fractionDigits: 0 })} ml consumed to produce ${formatNumber(command.bottles, { fractionDigits: 0 })} bottles in ${bottled.value.id}.`);
      const bottles = traceLot(bottled.value, state.week, 'Bottles allocated', `${formatNumber(command.bottles, { fractionDigits: 0 })} bottles of ${formatNumber(BOTTLE_ML, { fractionDigits: 0 })} ml produced from ${lot.id}.`);
      return success(archiveConsumedLots(replaceLot(replaceLot({ ...paid.value, inventory }, source), bottles)));
    }
    case 'wine.discard': {
      const consumed = consume(state.inventory, lot.id, command.quantity);
      if (!consumed.ok) return consumed;
      const recorded = traceLot(lot, state.week, 'Discarded', `Discarded ${formatNumber(command.quantity, { fractionDigits: 0 })} ${holding.unit}; no sale proceeds. Contract reservations remain protected.`);
      return success(archiveConsumedLots(replaceLot({ ...state, inventory: consumed.value }, recorded)));
    }
    default: return failure('Unsupported winery command.');
  }
}

function blendAction(state: CompanyState, command: Extract<GameCommand, { type: 'wine.blend' }>): RuleResult<CompanyState> {
  if (command.lotIds.length < 2) return failure('Select at least two distinct lots to blend.');
  const inputs = command.lotIds.map(id => ({ lot: state.winery.lots.find(l => l.id === id), holding: state.inventory.holdings.find(h => h.lotId === id) }));
  if (inputs.some(input => !input.lot || !input.holding || reservedBottles(state.inventory, input.lot.id))) return failure('Blending requires unreserved live lots.');
  const known = inputs as { lot: NonNullable<typeof inputs[number]['lot']>; holding: NonNullable<typeof inputs[number]['holding']> }[];
  const result = blendLots(known.map(input => ({ lot: input.lot, quantity: input.holding.quantity })), `lot-${state.sequence}`, command.name.trim(), state.week);
  if (!result.ok) return result;
  const vessel = state.equipment.vessels.find(v => v.id === command.vesselId);
  const quantity = known.reduce((sum, input) => sum + input.holding.quantity, 0);
  if (!vessel || !isUsableVessel(vessel)) return failure('Choose a maintained blend destination.');
  const placement = liquidDestinationIssue(state.inventory, vessel.id, quantity, vesselCapacityFreeMl(vessel, state.inventory.holdings, command.lotIds), command.lotIds);
  if (placement) return failure(placement);
  const filled = recordVesselFill(vessel);
  if (!filled.ok) return filled;
  const inventory = { ...state.inventory, holdings: [...state.inventory.holdings.filter(h => !command.lotIds.includes(h.lotId)), { lotId: result.value.id, quantity, unit: 'ml' as const, location: 'vessel' as const, vesselId: vessel.id }] };
  let traced = state;
  for (const input of known) traced = replaceLot(traced, traceLot(input.lot, state.week, 'Blended portion', `${formatNumber(input.holding.quantity, { fractionDigits: 0 })} ml consumed into ${result.value.id}.`));
  const blended = traceLot(result.value, state.week, 'Blend allocated', `${formatNumber(quantity, { fractionDigits: 0 })} ml allocated to ${vessel.name}; source portions are recorded on the archived parents.`);
  return success(archiveConsumedLots(replaceLot({ ...traced, sequence: state.sequence + 1, inventory, equipment: { ...state.equipment, vessels: state.equipment.vessels.map(v => v.id === vessel.id ? filled.value : v) } }, blended)));
}
