import type { CompanyState } from '../core/CompanyState';
import type { PhysicalLot } from '../wine/types';
import type { BuyerId } from '../commercial/types';
import { BOTTLE_ML, DAYS_PER_WEEK } from '../core/Numbers';
import { GRAPES, SITES } from '../vineyard/Catalog';
import { createWineOrigin, landValueCents } from '../vineyard/Origin';
import { harvestVineyard, MAX_VINEYARD_AREA_HA, MIN_VINEYARD_AREA_HA } from '../vineyard/Rules';
import { assessWine } from '../evaluation/Assessment';
import { canBottle } from '../wine/Operations';
import { developStoredLot } from '../simulation/DevelopStoredLot';
import { diagnoseWine, hasSeverePhysicalFault } from '../wine/Risks';
import { maturityOutlook } from '../wine/Maturation';
import { vesselCapacityFreeMl } from '../equipment/Rules';
import { availableQuantity, harvestStorageFreeG, reservedBottles } from '../inventory/Rules';
import { progressHarvestWork } from '../work/Rules';
import { contractEligibility, quoteWine } from '../commercial/Rules';
import { vesselPurchase } from '../equipment/Rules';
import { pressingCostCents, bottlingCostCents } from '../finance/ProcessingCosts';
import type { SiteId } from '../vineyard/types';
import type { VesselMaterial } from '../equipment/types';

/** Current-condition scenario, never consumes a live random stream or commits. */
export function forecastLot(state: CompanyState, lot: PhysicalLot, weeks = 12) {
  const holding = state.inventory.holdings.find(h => h.lotId === lot.id)!;
  const vessel = state.equipment.vessels.find(v => v.id === holding.vesselId) ?? null;
  const occupiedMl = vessel ? state.inventory.holdings.filter(h => h.vesselId === vessel.id).reduce((sum, h) => sum + h.quantity, 0) : 0;
  const future = developStoredLot({ lot, holding, vessel, cellarTemperatureC: state.equipment.cellarTemperatureC, occupiedMl, days: weeks * DAYS_PER_WEEK }).lot;
  const before = assessWine(lot);
  const after = assessWine(future);
  return {
    weeks, quality: after.quality,
    change: after.quality - before.quality,
    trajectory: after.quality > before.quality + 0.015 ? 'Improving' : after.quality < before.quality - 0.015 ? 'Declining' : 'Stable',
    assumption: `${weeks} weeks under the current vessel, temperature and process settings. This is a scenario, not a guaranteed drinking window.`,
  };
}

export function operationalStatus(lot: PhysicalLot): string {
  if (lot.form === 'grapes') return 'Harvested grapes — press soon';
  if (lot.processes.fermenting) return diagnoseWine(lot).some(fault => fault.code === 'stuck-fermentation') ? 'Fermentation stalled — review temperature and restart' : 'Fermenting';
  if (lot.form === 'must') return 'Must — start fermentation';
  if (hasSeverePhysicalFault(lot)) return 'At risk';
  const outlook = maturityOutlook(lot);
  if (outlook.label === 'Declining') return 'Past its maturity window';
  if (outlook.label === 'In maturity window') return 'In its maturity window';
  return lot.form === 'bottled' ? 'Bottled — developing' : 'Maturing in vessel';
}

/** All cross-domain calculations consumed by React live in this read layer. */
export function companyView(state: CompanyState) {
  const harvestable = new Map(state.estate.vineyards.map(v => {
    const result = harvestVineyard(v, Math.max(0, v.cropKg - v.harvestedKg));
    return [v.id, result.ok ? result.value.harvestedKg : 0];
  }));
  const workPreview = progressHarvestWork(state.work, state.estate.vineyards, state.estate.weather, harvestStorageFreeG(state.inventory) / 1000, harvestable, state.finance.wageArrearsCents > 0);
  const lots = state.winery.lots.map(lot => {
    const holding = state.inventory.holdings.find(h => h.lotId === lot.id)!;
    const assessment = assessWine(lot);
    const reserved = reservedBottles(state.inventory, lot.id);
    return {
      lot, holding, assessment, status: operationalStatus(lot),
      available: availableQuantity(state.inventory, lot.id), reserved,
      maximumBottles: holding.unit === 'ml' ? Math.floor(holding.quantity / BOTTLE_ML) : 0,
      pressingCostCents: holding.unit === 'g' ? pressingCostCents(holding.quantity) : null,
      maximumBottlingCostCents: holding.unit === 'ml' ? bottlingCostCents(Math.floor(holding.quantity / BOTTLE_ML)) : null,
      bottlingReadiness: canBottle(lot),
      vesselName: state.equipment.vessels.find(v => v.id === holding.vesselId)?.name ?? (holding.location === 'cellar' ? 'Bottle cellar' : 'Harvest receiving'),
      quotes: state.commercial.customers.map(customer => ({ customer, quote: quoteWine(lot, assessment, customer.id, customer.relationship, 1) })),
    };
  });
  return {
    week: state.week, weather: state.estate.weather,
    finance: state.finance,
    grapeOptions: Object.values(GRAPES), siteOptions: Object.values(SITES),
    vineyards: state.estate.vineyards.map(vineyard => ({ vineyard, grape: GRAPES[vineyard.grapeId], site: SITES[vineyard.siteId], origin: createWineOrigin(vineyard), harvestableKg: harvestable.get(vineyard.id) ?? 0, landValueCents: landValueCents(SITES[vineyard.siteId], vineyard.areaHa) })),
    lots,
    archivedLots: state.winery.archivedLots,
    vessels: state.equipment.vessels.map(vessel => ({ vessel, freeMl: vesselCapacityFreeMl(vessel, state.inventory.holdings), occupants: state.inventory.holdings.filter(h => h.vesselId === vessel.id).map(h => state.winery.lots.find(l => l.id === h.lotId)!) })),
    cellarTemperatureC: state.equipment.cellarTemperatureC,
    work: state.work, workPreview,
    harvestStorageFreeG: harvestStorageFreeG(state.inventory),
    customers: state.commercial.customers,
    contracts: state.commercial.contracts.map(contract => ({ contract, reserved: state.inventory.reservations.filter(r => r.contractId === contract.id).reduce((sum, r) => sum + r.bottles, 0), eligibleLots: lots.filter(row => contractEligibility(contract, row.lot, row.assessment, 1, state.week).eligible).map(row => row.lot.id) })),
    reservations: state.inventory.reservations,
    sales: state.commercial.sales,
    summary: {
      vineyardCount: state.estate.vineyards.length,
      liveLotCount: lots.length,
      bottlesInCellar: state.inventory.holdings.filter(h => h.unit === 'bottle').reduce((sum, h) => sum + h.quantity, 0),
      totalRevenueCents: state.commercial.sales.reduce((sum, sale) => sum + sale.revenueCents, 0),
      landAssetsCents: state.estate.vineyards.reduce((sum, v) => sum + landValueCents(SITES[v.siteId], v.areaHa), 0),
      activeCommitments: state.commercial.contracts.filter(c => c.status === 'accepted').length,
    },
  };
}

export function saleQuote(state: CompanyState, lotId: string, buyerId: BuyerId, bottles: number) {
  const lot = state.winery.lots.find(l => l.id === lotId);
  const customer = state.commercial.customers.find(c => c.id === buyerId);
  return lot && customer ? quoteWine(lot, assessWine(lot), buyerId, customer.relationship, bottles) : null;
}

export type CompanyView = ReturnType<typeof companyView>;
export type CellarLotView = CompanyView['lots'][number];

export function vineyardPurchaseQuote(siteId: SiteId, areaHa: number): number | null {
  if (!Number.isFinite(areaHa) || areaHa < MIN_VINEYARD_AREA_HA || areaHa > MAX_VINEYARD_AREA_HA) return null;
  return landValueCents(SITES[siteId], areaHa);
}

export function vesselPurchaseQuote(material: VesselMaterial, capacityLitres: number) {
  return vesselPurchase({ id: 'preview-vessel', material, capacityLitres });
}
