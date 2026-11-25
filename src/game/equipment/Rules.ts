import { clamp, failure, success, type RuleResult } from '../core/Numbers';
import type { Holding } from '../inventory/types';
import type { PhysicalLot, WineEnvironment } from '../wine/types';
import type { Vessel, VesselMaterial } from './types';
import { formatNumber } from '../../shared/numberFormat';

/** Provisional equipment prices and physical effects: game balance, not laboratory measurements. */
export const MIN_VESSEL_CAPACITY_LITRES = 1;
export const MAX_VESSEL_CAPACITY_LITRES = 100_000;
export const MIN_USABLE_VESSEL_CONDITION = 0.25;
export const VESSEL_CONDITION_LOSS_PER_OCCUPIED_WEEK = 0.002;
export const VESSEL_MAINTENANCE_REPLACEMENT_COST_FRACTION = 0.25;

export const VESSEL_MATERIALS: Readonly<Record<VesselMaterial, {
  readonly label: string;
  readonly fixedCostCents: number;
  readonly costPerLitreCents: number;
  readonly dailyOxygenIngress: number;
  readonly contaminationRisk: number;
}>> = {
  steel: { label: 'Steel', fixedCostCents: 20_000, costPerLitreCents: 150, dailyOxygenIngress: 0.0008, contaminationRisk: 0.01 },
  oak: { label: 'Oak', fixedCostCents: 30_000, costPerLitreCents: 500, dailyOxygenIngress: 0.006, contaminationRisk: 0.05 },
  concrete: { label: 'Concrete', fixedCostCents: 25_000, costPerLitreCents: 250, dailyOxygenIngress: 0.003, contaminationRisk: 0.025 },
};

export const BOTTLE_DAILY_OXYGEN_INGRESS = 0.0002;
export const BOTTLE_CONTAMINATION_RISK = 0.002;
export const HARVEST_RECEIVING_TEMPERATURE_C = 18;
export const HARVEST_DAILY_OXYGEN_INGRESS = 0.012;
export const HARVEST_CONTAMINATION_RISK = 0.1;
export const HEADSPACE_OXYGEN_MULTIPLIER = 3;
export const POOR_CONDITION_OXYGEN_MULTIPLIER = 2;
export const HEADSPACE_CONTAMINATION_PRESSURE = 0.08;
export const POOR_CONDITION_CONTAMINATION_PRESSURE = 0.35;
export const PRIOR_FILL_CONTAMINATION_PRESSURE = 0.01;
export const MAX_PRIOR_FILL_CONTAMINATION_PRESSURE = 0.1;
export const OAK_PRIOR_FILL_DECAY = 0.35;
export const OAK_CONDITION_BASE = 0.35;
export const OAK_FULL_VESSEL_CONTACT = 0.7;

function replacementCostCents(material: VesselMaterial, capacityLitres: number): number {
  const price = VESSEL_MATERIALS[material];
  return Math.round(price.fixedCostCents + price.costPerLitreCents * capacityLitres);
}

export function vesselPurchase(input: { id: string; material: VesselMaterial; capacityLitres: number }): RuleResult<{ vessel: Vessel; costCents: number }> {
  if (!input || typeof input.id !== 'string' || input.id.trim().length === 0) return failure('A vessel ID is required.');
  if (!Object.hasOwn(VESSEL_MATERIALS, input.material)) return failure('Choose a supported vessel material.');
  if (!Number.isSafeInteger(input.capacityLitres)
    || input.capacityLitres < MIN_VESSEL_CAPACITY_LITRES
    || input.capacityLitres > MAX_VESSEL_CAPACITY_LITRES) {
    return failure(`Vessel capacity must be a whole number from ${formatNumber(MIN_VESSEL_CAPACITY_LITRES, { fractionDigits: 0 })} to ${formatNumber(MAX_VESSEL_CAPACITY_LITRES, { fractionDigits: 0 })} litres.`);
  }
  const material = VESSEL_MATERIALS[input.material];
  const vessel: Vessel = Object.freeze({
    id: input.id.trim(),
    name: `${material.label} vessel (${formatNumber(input.capacityLitres, { fractionDigits: 0 })} L)`,
    material: input.material,
    capacityMl: input.capacityLitres * 1000,
    condition: 1,
    uses: 0,
  });
  return success(Object.freeze({ vessel, costCents: replacementCostCents(input.material, input.capacityLitres) }));
}

/** Capacity is physical space; inventory separately enforces one coherent lot per vessel. */
export function vesselCapacityFreeMl(vessel: Vessel, holdings: readonly Holding[], exceptLotIds: readonly string[] = []): number {
  const except = new Set(exceptLotIds);
  const occupied = holdings.reduce((sum, holding) =>
    holding.vesselId === vessel.id && holding.unit === 'ml' && !except.has(holding.lotId)
      ? sum + holding.quantity
      : sum, 0);
  return Math.max(0, vessel.capacityMl - occupied);
}

export function isUsableVessel(vessel: Vessel): boolean {
  return vessel.condition >= MIN_USABLE_VESSEL_CONDITION;
}

/** Uses counts fills, including the first; it is never reset by maintenance. */
export function recordVesselFill(vessel: Vessel): RuleResult<Vessel> {
  if (!Number.isSafeInteger(vessel.uses) || vessel.uses < 0 || vessel.uses >= Number.MAX_SAFE_INTEGER) {
    return failure('Vessel fill count cannot be safely incremented.');
  }
  return success(Object.freeze({ ...vessel, uses: vessel.uses + 1 }));
}

export function maintainVessel(vessel: Vessel): { vessel: Vessel; costCents: number } {
  const costCents = Math.round(replacementCostCents(vessel.material, vessel.capacityMl / 1000)
    * (1 - clamp(vessel.condition)) * VESSEL_MAINTENANCE_REPLACEMENT_COST_FRACTION);
  return Object.freeze({ vessel: Object.freeze({ ...vessel, condition: 1 }), costCents });
}

/** A filled vessel wears once each week regardless of the number of matching holdings. */
export function ageVessels(vessels: readonly Vessel[], holdings: readonly Holding[]): readonly Vessel[] {
  const occupied = new Set(holdings.filter(holding => holding.vesselId !== null
    && holding.unit === 'ml' && holding.quantity > 0).map(holding => holding.vesselId));
  return Object.freeze(vessels.map(vessel => occupied.has(vessel.id)
    ? Object.freeze({ ...vessel, condition: clamp(vessel.condition - VESSEL_CONDITION_LOSS_PER_OCCUPIED_WEEK) })
    : vessel));
}

/** Resolve transient environmental exposure from placement, never storing occupancy on a vessel or lot. */
export function resolveWineEnvironment(
  lot: PhysicalLot,
  holding: Holding,
  vessel: Vessel | null,
  cellarTemperatureC: number,
  occupiedMl?: number,
): WineEnvironment {
  if (!Number.isFinite(cellarTemperatureC)) throw new RangeError('Cellar temperature must be finite.');
  if (lot.form === 'grapes') return Object.freeze({
    temperatureC: HARVEST_RECEIVING_TEMPERATURE_C,
    oxygenIngress: HARVEST_DAILY_OXYGEN_INGRESS,
    oakStrength: 0,
    contaminationRisk: HARVEST_CONTAMINATION_RISK,
  });
  if (lot.form === 'bottled') return Object.freeze({
    temperatureC: cellarTemperatureC,
    oxygenIngress: BOTTLE_DAILY_OXYGEN_INGRESS,
    oakStrength: 0,
    contaminationRisk: BOTTLE_CONTAMINATION_RISK,
  });
  if (!vessel || holding.unit !== 'ml' || holding.vesselId !== vessel.id) {
    throw new RangeError('A liquid lot requires its allocated vessel.');
  }
  const fillMl = occupiedMl ?? holding.quantity;
  if (!Number.isFinite(fillMl) || fillMl < 0) throw new RangeError('Occupied volume must be non-negative and finite.');
  const fill = clamp(fillMl / vessel.capacityMl);
  const headspace = 1 - fill;
  const condition = clamp(vessel.condition);
  // The first fill is fresh; all earlier fills diminish the remaining oak influence.
  const priorFills = Math.max(0, vessel.uses - 1);
  const material = VESSEL_MATERIALS[vessel.material];
  const oxygenIngress = material.dailyOxygenIngress
    * (1 + headspace * HEADSPACE_OXYGEN_MULTIPLIER + (1 - condition) * POOR_CONDITION_OXYGEN_MULTIPLIER);
  const contaminationRisk = clamp(material.contaminationRisk
    + headspace * HEADSPACE_CONTAMINATION_PRESSURE
    + (1 - condition) * POOR_CONDITION_CONTAMINATION_PRESSURE
    + Math.min(MAX_PRIOR_FILL_CONTAMINATION_PRESSURE, priorFills * PRIOR_FILL_CONTAMINATION_PRESSURE));
  const oakStrength = vessel.material === 'oak'
    ? clamp((OAK_CONDITION_BASE + (1 - OAK_CONDITION_BASE) * condition)
      * (OAK_FULL_VESSEL_CONTACT + (1 - OAK_FULL_VESSEL_CONTACT) * headspace)
      / (1 + priorFills * OAK_PRIOR_FILL_DECAY))
    : 0;
  return Object.freeze({
    temperatureC: lot.processes.fermenting ? lot.processes.temperatureC : cellarTemperatureC,
    oxygenIngress,
    oakStrength,
    contaminationRisk,
  });
}
