import type { CompanyState } from './CompanyState';
import { BOTTLE_ML } from './Numbers';
import { MAX_VINEYARD_AREA_HA, MIN_VINEYARD_AREA_HA } from '../vineyard/Rules';
import { WINE_MATERIAL_LIMITS } from '../wine/MaterialLimits';

type Check = (value: unknown) => boolean;
const text: Check = v => typeof v === 'string' && v.length > 0 && v.length <= 500;
const identifier: Check = v => typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(v);
const num = (low: number, high = Number.MAX_SAFE_INTEGER): Check => v => typeof v === 'number' && Number.isFinite(v) && v >= low && v <= high;
const integer = (low = 0): Check => v => typeof v === 'number' && Number.isSafeInteger(v) && v >= low;
const fraction = num(0, 1);
const bool: Check = v => typeof v === 'boolean';
const oneOf = (...items: readonly unknown[]): Check => v => items.includes(v);
const nullable = (check: Check): Check => v => v === null || check(v);
const array = (check: Check): Check => v => Array.isArray(v) && v.length <= 100_000 && v.every(check);
const shape = (fields: Readonly<Record<string, Check>>): Check => v => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const row = v as Record<string, unknown>;
  return Object.keys(row).length === Object.keys(fields).length && Object.entries(fields).every(([key, check]) => Object.hasOwn(row, key) && check(row[key]));
};
const grape = oneOf('pinot-noir', 'tempranillo', 'sauvignon-blanc', 'chardonnay');
const site = oneOf('hillside', 'riverbend', 'heritage');
const buyer = oneOf('local-merchant', 'restaurant', 'collector');
const vineyard = shape({ id: identifier, name: text, siteId: site, grapeId: grape, areaHa: num(MIN_VINEYARD_AREA_HA, MAX_VINEYARD_AREA_HA), plantedYear: integer(Number.MIN_SAFE_INTEGER), cropYear: integer(Number.MIN_SAFE_INTEGER), ripeness: fraction, condition: fraction, cropKg: num(0), harvestedKg: num(0), rot: fraction, nobleRot: fraction });
const weather = shape({ temperatureC: num(-30, 60), rainMm: num(0, 1000), humidity: fraction });
const anchors = shape({ sugarGPerL: num(0, WINE_MATERIAL_LIMITS.sugarGPerL), acidity: fraction, phenolics: fraction, aromatics: fraction, body: fraction, agingPotential: fraction });
const physical = shape({ sugarGPerL: num(0, WINE_MATERIAL_LIMITS.sugarGPerL), alcoholPct: num(0, WINE_MATERIAL_LIMITS.alcoholPct), acidity: fraction, phenolics: fraction, remainingPhenolics: fraction, aroma: fraction, yeastActivity: fraction, oxygenExposure: num(0), oxidation: fraction, maturation: num(0), oak: fraction, lees: fraction, greenCharacter: fraction, rot: fraction, ageDays: integer() });
const origin = shape({ vineyardId: identifier, vineyardName: text, region: text, siteId: site, grapeId: grape, vintage: integer(Number.MIN_SAFE_INTEGER), terroirPotential: fraction, originPrestige: fraction });
const history = shape({ week: integer(), action: text, detail: text });
const bottling = shape({ week: integer(), structure: fraction, taste: fraction, quality: fraction });
const lot = shape({ id: identifier, wineId: identifier, name: text, form: oneOf('grapes', 'must', 'wine', 'bottled'), origin, anchors, physical, processes: shape({ fermenting: bool, skinContact: bool, temperatureC: num(2, 40), leesContact: bool }), parentIds: array(identifier), sources: array(shape({ origin, anchors, fraction: num(Number.MIN_VALUE, 1) })), history: array(history), bottling: nullable(bottling) });
const holding = shape({ lotId: identifier, quantity: integer(1), unit: oneOf('g', 'ml', 'bottle'), location: oneOf('harvest', 'vessel', 'cellar'), vesselId: nullable(identifier) });
const reservation = shape({ contractId: identifier, lotId: identifier, bottles: integer(1) });
const vessel = shape({ id: identifier, name: text, material: oneOf('steel', 'oak', 'concrete'), capacityMl: integer(1), condition: fraction, uses: integer() });
const posting = shape({ id: identifier, week: integer(), amountCents: integer(Number.MIN_SAFE_INTEGER), category: oneOf('capital', 'land', 'equipment', 'processing', 'sale', 'contract', 'wages'), description: text });
const worker = shape({ id: identifier, name: text, kgPerWeek: num(1, 100_000), experience: num(0) });
const activity = shape({ id: identifier, vineyardId: identifier, targetKg: num(0.001), completedKg: num(0), staffIds: array(identifier), priority: integer(), blockedReason: nullable(text) });
const contract = shape({ id: identifier, buyerId: buyer, grapeId: nullable(grape), bottles: integer(1), minimumStructure: fraction, minimumTaste: fraction, minimumAgeDays: integer(), pricePerBottleCents: integer(1), dueWeek: integer(), status: oneOf('offered', 'accepted', 'fulfilled', 'expired', 'defaulted') });
const customer = shape({ id: buyer, relationship: fraction, bottlesBought: integer() });
const sale = shape({ id: identifier, week: integer(), lotId: identifier, buyerId: buyer, bottles: integer(1), revenueCents: integer(1), contractId: nullable(identifier) });

/** Current schema only. Check all shapes before dereferencing cross-domain data. */
export function validateGameplayState(input: Record<string, unknown>): string[] {
  const checks: Record<string, Check> = {
    week: integer(), sequence: integer(1),
    estate: shape({ vineyards: array(vineyard), weather }),
    winery: shape({ lots: array(lot), archivedLots: array(lot) }),
    inventory: shape({ holdings: array(holding), reservations: array(reservation) }),
    equipment: shape({ vessels: array(vessel), cellarTemperatureC: num(2, 35) }),
    finance: shape({ cashCents: integer(), wageArrearsCents: integer(), postings: array(posting) }),
    work: shape({ staff: array(worker), activities: array(activity) }),
    commercial: shape({ customers: array(customer), contracts: array(contract), sales: array(sale) }),
  };
  const reasons = Object.entries(checks).filter(([key, check]) => !check(input[key])).map(([key]) => `Invalid current company ${key}.`);
  if (reasons.length) return reasons;
  const state = input as unknown as CompanyState;
  const unique = (ids: readonly string[], label: string) => { if (new Set(ids).size !== ids.length) reasons.push(`Duplicate ${label} IDs.`); };
  unique(state.estate.vineyards.map(v => v.id), 'vineyard');
  unique([...state.winery.lots, ...state.winery.archivedLots].map(v => v.id), 'lot');
  unique(state.inventory.holdings.map(v => v.lotId), 'holding');
  unique(state.equipment.vessels.map(v => v.id), 'vessel');
  unique(state.work.staff.map(v => v.id), 'worker');
  unique(state.work.activities.map(v => v.id), 'activity');
  unique(state.commercial.contracts.map(v => v.id), 'contract');
  unique(state.commercial.customers.map(v => v.id), 'customer');
  unique(state.commercial.sales.map(v => v.id), 'sale');
  unique(state.finance.postings.map(v => v.id), 'posting');
  unique(state.inventory.reservations.map(v => `${v.contractId}/${v.lotId}`), 'reservation');
  const generatedIds = [
    ...state.estate.vineyards.map(v => v.id), ...state.winery.lots.map(v => v.id), ...state.winery.archivedLots.map(v => v.id),
    ...state.equipment.vessels.map(v => v.id), ...state.work.activities.map(v => v.id), ...state.finance.postings.map(v => v.id), ...state.commercial.sales.map(v => v.id),
  ];
  if (generatedIds.some(id => {
    const suffix = /^(?:vineyard|lot|vessel|harvest|posting|sale)-(\d+)$/.exec(id)?.[1];
    return suffix !== undefined && Number(suffix) >= state.sequence;
  })) reasons.push('The next entity sequence must follow all generated IDs.');
  const lots = new Map(state.winery.lots.map(v => [v.id, v]));
  const allLots = new Map([...state.winery.archivedLots, ...state.winery.lots].map(v => [v.id, v]));
  const vessels = new Map(state.equipment.vessels.map(v => [v.id, v]));
  const holdings = new Map(state.inventory.holdings.map(v => [v.lotId, v]));
  const contracts = new Map(state.commercial.contracts.map(v => [v.id, v]));
  if (lots.size !== holdings.size) reasons.push('Each live lot requires exactly one holding.');
  for (const lot of allLots.values()) {
    if (lots.has(lot.id) && !holdings.has(lot.id)) reasons.push(`Missing holding for ${lot.id}.`);
    if (lot.physical.phenolics + lot.physical.remainingPhenolics > lot.anchors.phenolics + 1e-7) reasons.push(`Phenolic material exceeds inherited capacity for ${lot.id}.`);
    if (lot.physical.sugarGPerL > lot.anchors.sugarGPerL + 1e-7) reasons.push(`Sugar exceeds inherited capacity for ${lot.id}.`);
    if (lot.parentIds.includes(lot.id) || new Set(lot.parentIds).size !== lot.parentIds.length) reasons.push(`Invalid lineage for ${lot.id}.`);
    if (!lot.sources.length || Math.abs(lot.sources.reduce((sum, source) => sum + source.fraction, 0) - 1) > 1e-7) reasons.push(`Invalid source proportions for ${lot.id}.`);
    if (Object.keys(lot.anchors).some(key => {
      const axis = key as keyof typeof lot.anchors;
      return Math.abs(lot.anchors[axis] - lot.sources.reduce((sum, source) => sum + source.anchors[axis] * source.fraction, 0)) > 1e-7;
    })) reasons.push(`Inherited anchors disagree with source baselines for ${lot.id}.`);
    if (lot.parentIds.some(id => !allLots.has(id))) reasons.push(`Missing lineage parent for ${lot.id}.`);
    if (lot.history.some((event, index) => event.week > state.week || (index > 0 && event.week < lot.history[index - 1].week))) reasons.push(`Invalid history chronology for ${lot.id}.`);
    if (lot.form === 'bottled' && (!lot.bottling || lot.processes.fermenting || lot.processes.skinContact)) reasons.push(`Invalid bottled process facts for ${lot.id}.`);
    if (lot.form !== 'bottled' && lot.bottling) reasons.push(`Unexpected bottling snapshot for ${lot.id}.`);
  }
  const lineageStatus = new Map<string, 'active' | 'complete'>();
  let cyclic = false;
  for (const rootId of allLots.keys()) {
    if (lineageStatus.get(rootId) === 'complete') continue;
    const stack: [string, boolean][] = [[rootId, false]];
    while (stack.length) {
      const [id, exiting] = stack.pop()!;
      if (exiting) { lineageStatus.set(id, 'complete'); continue; }
      if (lineageStatus.get(id) === 'active') { cyclic = true; break; }
      if (lineageStatus.get(id) === 'complete') continue;
      lineageStatus.set(id, 'active'); stack.push([id, true]);
      for (const parent of allLots.get(id)?.parentIds ?? []) stack.push([parent, false]);
    }
    if (cyclic) break;
  }
  if (cyclic) reasons.push('Lot lineage must not contain a cycle.');
  const occupied = new Map<string, number>();
  const occupiedLots = new Set<string>();
  for (const item of holdings.values()) {
    const material = lots.get(item.lotId);
    if (!material) { reasons.push(`Unknown holding lot ${item.lotId}.`); continue; }
    const expectedUnit = material.form === 'grapes' ? 'g' : material.form === 'bottled' ? 'bottle' : 'ml';
    if (item.unit !== expectedUnit) reasons.push(`Invalid material unit for ${item.lotId}.`);
    if ((item.location === 'vessel') !== (item.vesselId !== null)) reasons.push(`Invalid vessel placement for ${item.lotId}.`);
    if (material.form === 'bottled' && item.location !== 'cellar') reasons.push(`Bottles must be in cellar storage.`);
    if ((material.form === 'must' || material.form === 'wine') && item.location !== 'vessel') reasons.push(`Liquid must occupy a vessel.`);
    if (item.vesselId) {
      if (occupiedLots.has(item.vesselId)) reasons.push(`Vessel ${item.vesselId} must contain one coherent lot.`);
      occupiedLots.add(item.vesselId);
      if (!vessels.has(item.vesselId) || item.unit !== 'ml') reasons.push(`Invalid vessel allocation for ${item.lotId}.`);
      occupied.set(item.vesselId, (occupied.get(item.vesselId) ?? 0) + item.quantity);
    }
    const reserved = state.inventory.reservations.filter(r => r.lotId === item.lotId).reduce((sum, r) => sum + r.bottles, 0);
    if (reserved && (item.unit !== 'bottle' || reserved > item.quantity)) reasons.push(`Reservation exceeds available bottles for ${item.lotId}.`);
  }
  for (const [id, amount] of occupied) if (amount > (vessels.get(id)?.capacityMl ?? 0)) reasons.push(`Vessel ${id} is over capacity.`);
  for (const reservation of state.inventory.reservations) {
    const contract = contracts.get(reservation.contractId);
    if (!contract || contract.status !== 'accepted' || !holdings.has(reservation.lotId)) reasons.push('Reservation has no accepted contract or holding.');
  }
  for (const contract of contracts.values()) {
    const reserved = state.inventory.reservations.filter(r => r.contractId === contract.id).reduce((sum, r) => sum + r.bottles, 0);
    if (reserved > contract.bottles) reasons.push(`Over-reserved contract ${contract.id}.`);
  }
  for (const activity of state.work.activities) {
    if (!state.estate.vineyards.some(v => v.id === activity.vineyardId) || activity.completedKg > activity.targetKg || !activity.staffIds.length || new Set(activity.staffIds).size !== activity.staffIds.length || !activity.staffIds.every(id => state.work.staff.some(v => v.id === id))) reasons.push(`Invalid harvest activity ${activity.id}.`);
  }
  for (const vineyard of state.estate.vineyards) if (vineyard.harvestedKg > vineyard.cropKg + 1e-7) reasons.push(`Harvest exceeds vineyard crop ${vineyard.id}.`);
  if (state.finance.postings.reduce((sum, p) => sum + p.amountCents, 0) !== state.finance.cashCents) reasons.push('Cash and financial postings disagree.');
  for (const unit of ['g', 'ml', 'bottle'] as const) {
    const quantity = state.inventory.holdings.filter(h => h.unit === unit).reduce((sum, h) => sum + h.quantity, 0);
    if (!Number.isSafeInteger(quantity) || (unit === 'bottle' && !Number.isSafeInteger(quantity * BOTTLE_ML))) reasons.push(`Inventory exceeds supported ${unit} quantity.`);
  }
  return reasons;
}
