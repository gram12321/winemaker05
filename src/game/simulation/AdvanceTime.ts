import { planCalendarAdvance } from '../calendar/Calendar';
import { readCompanyState, type CompanyState } from '../core/CompanyState';
import type { CommandDecision, DomainEvent } from '../core/Results';
import { DAYS_PER_WEEK } from '../core/Numbers';
import { advanceVineyard, harvestVineyard, resolveWeather } from '../vineyard/Rules';
import { GRAPES } from '../vineyard/Catalog';
import { createWineOrigin } from '../vineyard/Origin';
import { harvestStorageFreeG } from '../inventory/Rules';
import { progressHarvestWork } from '../work/Rules';
import { developStoredLot } from './DevelopStoredLot';
import { createHarvestLot } from '../wine/Anchors';
import { ageVessels } from '../equipment/Rules';
import { payWeeklyWages } from '../finance/Rules';
import { advanceContracts, createContractOffers } from '../commercial/Rules';
import { traceLot } from '../commands/Transactions';

/** Produce an independent candidate and event; the authority decides whether to commit it. */
export function advanceTime(state: CompanyState): CommandDecision {
  const company = readCompanyState(state);
  if (company.kind === 'invalid') return { kind: 'rejected', reasons: company.reasons };
  const planned = planCalendarAdvance(company.state.calendar);
  if (planned.kind === 'rejected') return planned;
  const current = company.state;
  const week = current.week + 1;
  if (!Number.isSafeInteger(week)) return { kind: 'rejected', reasons: ['The elapsed week count is outside the supported range.'] };

  // One candidate: nothing here performs I/O or publishes a partial phase.
  const weather = resolveWeather(planned.next, week);
  let vineyards = current.estate.vineyards.map(v => advanceVineyard(v, weather, planned.next, planned.interval.crossedYear));
  const harvestable = new Map(vineyards.map(v => {
    const available = harvestVineyard(v, Math.max(0, v.cropKg - v.harvestedKg));
    return [v.id, available.ok ? available.value.harvestedKg : 0];
  }));
  const work = progressHarvestWork(
    { ...current.work, activities: planned.interval.crossedYear ? [] : current.work.activities },
    vineyards, weather, harvestStorageFreeG(current.inventory) / 1000, harvestable,
    current.finance.wageArrearsCents > 0,
  );
  const lots = current.winery.lots.map(lot => {
    const holding = current.inventory.holdings.find(h => h.lotId === lot.id)!;
    const vessel = current.equipment.vessels.find(v => v.id === holding.vesselId) ?? null;
    const occupied = vessel ? current.inventory.holdings.filter(h => h.vesselId === vessel.id).reduce((sum, h) => sum + h.quantity, 0) : 0;
    const developed = developStoredLot({ lot, holding, vessel, cellarTemperatureC: current.equipment.cellarTemperatureC, occupiedMl: occupied, days: DAYS_PER_WEEK });
    return traceLot(developed.lot, week, 'Development', developed.causes.join(' ').slice(0, 500) || 'Continued development under the current storage conditions.');
  });
  const holdings = [...current.inventory.holdings];
  let sequence = current.sequence;
  // Boundary-created lots are deliberately absent from the development phase above.
  for (const output of work.outputs) {
    const vineyard = vineyards.find(v => v.id === output.vineyardId)!;
    const harvested = harvestVineyard(vineyard, output.kilograms);
    if (!harvested.ok || Math.abs(harvested.value.harvestedKg - output.kilograms) > 1e-7) return { kind: 'rejected', reasons: ['Harvest work and available material did not reconcile.'] };
    vineyards = vineyards.map(v => v.id === vineyard.id ? harvested.value.vineyard : v);
    const lot = createHarvestLot({ id: `lot-${sequence++}`, wineId: `${vineyard.id}-${vineyard.cropYear}`, name: `${GRAPES[vineyard.grapeId].name} · ${vineyard.cropYear}`, origin: createWineOrigin(vineyard), vineyard, week });
    lots.push(lot);
    holdings.push({ lotId: lot.id, quantity: Math.round(output.kilograms * 1000), unit: 'g', location: 'harvest', vesselId: null });
  }
  const finance = payWeeklyWages(current.finance, current.work.staff.length, week);
  let commercial = advanceContracts(current.commercial, week);
  // Offers are dated company/NPC commitments, not shared-market listings.
  if (week === 1 || week % 4 === 0) {
    const offers = createContractOffers(week).filter(offer => !commercial.contracts.some(c => c.buyerId === offer.buyerId && (c.status === 'offered' || c.status === 'accepted')));
    commercial = { ...commercial, contracts: [...commercial.contracts, ...offers] };
  }
  const candidate = readCompanyState({
    ...current, calendar: planned.next, week, sequence,
    estate: { vineyards, weather }, work: work.work,
    winery: { ...current.winery, lots },
    inventory: { holdings, reservations: current.inventory.reservations.filter(r => commercial.contracts.some(c => c.id === r.contractId && c.status === 'accepted')) },
    equipment: { ...current.equipment, vessels: ageVessels(current.equipment.vessels, current.inventory.holdings) },
    finance, commercial,
  });
  if (candidate.kind === 'invalid') return { kind: 'rejected', reasons: candidate.reasons };

  const event: DomainEvent = Object.freeze({ type: 'time.advanced', ...planned.interval });
  return {
    kind: 'accepted',
    next: candidate.state,
    events: Object.freeze([event]),
  };
}
