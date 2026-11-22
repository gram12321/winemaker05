import type { GrapeId, SiteId } from '../vineyard/types';

/** Immutable harvest baseline; remaining resources belong to PhysicalState. */
export interface RawMaterialAnchors {
  readonly sugarGPerL: number;
  readonly acidity: number;
  readonly phenolics: number;
  readonly aromatics: number;
  readonly body: number;
  readonly agingPotential: number;
}

export interface WineOrigin {
  readonly vineyardId: string;
  readonly vineyardName: string;
  readonly region: string;
  readonly siteId: SiteId;
  readonly grapeId: GrapeId;
  readonly vintage: number;
  readonly terroirPotential: number;
  readonly originPrestige: number;
}

/** Concentrations/normalized capacities, never a second inventory amount. */
export interface PhysicalState {
  readonly sugarGPerL: number;
  readonly alcoholPct: number;
  readonly acidity: number;
  readonly phenolics: number;
  readonly remainingPhenolics: number;
  readonly aroma: number;
  readonly yeastActivity: number;
  readonly oxygenExposure: number;
  readonly oxidation: number;
  readonly maturation: number;
  readonly oak: number;
  readonly lees: number;
  readonly greenCharacter: number;
  readonly rot: number;
  readonly ageDays: number;
}

export interface ProcessSettings {
  readonly fermenting: boolean;
  readonly skinContact: boolean;
  readonly temperatureC: number;
  readonly leesContact: boolean;
}

export interface LotHistory {
  readonly week: number;
  readonly action: string;
  readonly detail: string;
}

export interface BottlingAssessment {
  readonly week: number;
  readonly structure: number;
  readonly taste: number;
  readonly quality: number;
}

export interface PhysicalLot {
  readonly id: string;
  readonly wineId: string;
  readonly name: string;
  readonly form: 'grapes' | 'must' | 'wine' | 'bottled';
  readonly origin: WineOrigin;
  readonly anchors: RawMaterialAnchors;
  readonly physical: PhysicalState;
  readonly processes: ProcessSettings;
  readonly parentIds: readonly string[];
  readonly sources: readonly { readonly origin: WineOrigin; readonly anchors: RawMaterialAnchors; readonly fraction: number }[];
  readonly history: readonly LotHistory[];
  readonly bottling: BottlingAssessment | null;
}

export interface WineEnvironment {
  /** Actual Celsius experienced by this lot, not an offset from a setpoint. */
  readonly temperatureC: number;
  /** Normalized exposure units per day; accumulated by the risk rule. */
  readonly oxygenIngress: number;
  /** Normalized current extractable oak influence and contamination pressure. */
  readonly oakStrength: number;
  readonly contaminationRisk: number;
}

export interface WineryState {
  readonly lots: readonly PhysicalLot[];
  readonly archivedLots: readonly PhysicalLot[];
}
