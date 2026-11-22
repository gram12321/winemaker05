import type { CompanyState } from '../core/CompanyState';
import type { GameCommand } from '../core/Commands';
import type { Sale } from '../commercial/types';
import { failure, success, type RuleResult } from '../core/Numbers';
import { acceptContract, contractEligibility, quoteWine, recordSale } from '../commercial/Rules';
import { assessWine } from '../evaluation/Assessment';
import { availableQuantity, consume } from '../inventory/Rules';
import { archiveConsumedLots, recordPayment, replaceLot, traceLot } from './Transactions';

export function commercialAction(state: CompanyState, command: GameCommand): RuleResult<CompanyState> {
  switch (command.type) {
    case 'wine.sell': {
      const lot = state.winery.lots.find(l => l.id === command.lotId);
      const customer = state.commercial.customers.find(c => c.id === command.buyerId);
      if (!lot || !customer || lot.form !== 'bottled') return failure('Choose a bottled wine and an available buyer.');
      if (command.bottles <= 0 || command.bottles > availableQuantity(state.inventory, lot.id)) return failure('The requested bottles are unavailable or reserved.');
      const quote = quoteWine(lot, assessWine(lot), customer.id, customer.relationship, command.bottles);
      if (!quote.ok) return quote;
      const consumed = consume(state.inventory, lot.id, command.bottles);
      if (!consumed.ok) return consumed;
      const paid = recordPayment(state, 'sale', quote.value.totalCents, `${command.bottles} bottles of ${lot.name} to ${customer.id}`);
      if (!paid.ok) return paid;
      const sale: Sale = { id: `sale-${paid.value.sequence}`, week: state.week, lotId: lot.id, buyerId: customer.id, bottles: command.bottles, revenueCents: quote.value.totalCents, contractId: null };
      const commercial = recordSale(state.commercial, sale);
      if (!commercial.ok) return commercial;
      const recorded = traceLot(lot, state.week, 'Sold', `${command.bottles} bottles sold to ${customer.id} for ${quote.value.totalCents} cents.`);
      return success(archiveConsumedLots(replaceLot({ ...paid.value, sequence: paid.value.sequence + 1, inventory: consumed.value, commercial: commercial.value }, recorded)));
    }
    case 'contract.accept': {
      const contract = state.commercial.contracts.find(c => c.id === command.contractId);
      if (!contract) return failure('The contract offer does not exist.');
      const accepted = acceptContract(contract, state.week);
      if (!accepted.ok) return accepted;
      return success({ ...state, commercial: { ...state.commercial, contracts: state.commercial.contracts.map(c => c.id === contract.id ? accepted.value : c) } });
    }
    case 'contract.reserve': {
      const contract = state.commercial.contracts.find(c => c.id === command.contractId);
      if (!contract || contract.status !== 'accepted') return failure('Accept the contract before allocating wine.');
      const other = state.inventory.reservations.filter(r => !(r.contractId === contract.id && r.lotId === command.lotId));
      if (command.bottles === 0) return success({ ...state, inventory: { ...state.inventory, reservations: other } });
      const lot = state.winery.lots.find(l => l.id === command.lotId);
      if (!lot) return failure('The wine lot is unavailable.');
      const eligibility = contractEligibility(contract, lot, assessWine(lot), command.bottles, state.week);
      if (!eligibility.eligible) return failure(eligibility.reasons.join(' '));
      const already = other.filter(r => r.contractId === contract.id).reduce((sum, r) => sum + r.bottles, 0);
      if (already + command.bottles > contract.bottles || command.bottles > availableQuantity(state.inventory, lot.id, contract.id)) return failure('This allocation exceeds the contract or unreserved bottle quantity.');
      return success({ ...state, inventory: { ...state.inventory, reservations: [...other, { contractId: contract.id, lotId: lot.id, bottles: command.bottles }] } });
    }
    case 'contract.fulfill': return fulfill(state, command.contractId);
    default: return failure('Unsupported commercial command.');
  }
}

function fulfill(state: CompanyState, contractId: string): RuleResult<CompanyState> {
  const contract = state.commercial.contracts.find(c => c.id === contractId);
  if (!contract || contract.status !== 'accepted') return failure('The contract is not an active commitment.');
  const reservations = state.inventory.reservations.filter(r => r.contractId === contract.id).sort((a, b) => a.lotId.localeCompare(b.lotId));
  if (reservations.reduce((sum, r) => sum + r.bottles, 0) !== contract.bottles) return failure('Reserve the full contract quantity before delivery.');
  let inventory = state.inventory;
  let commercial = state.commercial;
  let sequence = state.sequence;
  let traced = state;
  for (const reservation of reservations) {
    const lot = state.winery.lots.find(l => l.id === reservation.lotId);
    if (!lot) return failure('Reserved wine is unavailable.');
    const eligibility = contractEligibility(contract, lot, assessWine(lot), reservation.bottles, state.week);
    if (!eligibility.eligible) return failure(eligibility.reasons.join(' '));
    const consumed = consume(inventory, lot.id, reservation.bottles, contract.id);
    if (!consumed.ok) return consumed;
    inventory = { ...consumed.value, reservations: consumed.value.reservations.filter(r => !(r.contractId === contract.id && r.lotId === lot.id)) };
    const recordedSale = recordSale(commercial, { id: `sale-${sequence++}`, week: state.week, lotId: lot.id, buyerId: contract.buyerId, bottles: reservation.bottles, revenueCents: contract.pricePerBottleCents * reservation.bottles, contractId: contract.id });
    if (!recordedSale.ok) return recordedSale;
    commercial = recordedSale.value;
    traced = replaceLot(traced, traceLot(lot, state.week, 'Contract delivery', `${reservation.bottles} bottles delivered under ${contract.id}.`));
  }
  const paid = recordPayment({ ...traced, sequence }, 'contract', contract.pricePerBottleCents * contract.bottles, `Delivered contract ${contract.id}`);
  if (!paid.ok) return paid;
  return success(archiveConsumedLots({ ...paid.value, inventory, commercial: { ...commercial, contracts: commercial.contracts.map(c => c.id === contract.id ? { ...c, status: 'fulfilled' } : c) } }));
}
