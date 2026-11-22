export type GrapeId = 'pinot-noir' | 'tempranillo' | 'sauvignon-blanc' | 'chardonnay';
export type SiteId = 'hillside' | 'riverbend' | 'heritage';

export interface GrapeDefinition {
  readonly id: GrapeId;
  readonly name: string;
  readonly color: 'red' | 'white';
  readonly sugar: number;
  readonly acidity: number;
  readonly phenolics: number;
  readonly aromatics: number;
  readonly body: number;
  readonly aging: number;
  readonly preferredTemperatureC: number;
  readonly sitePreferences: {
    readonly drainage: number;
    readonly sunlight: number;
    readonly fertility: number;
    readonly altitudeM: number;
  };
}

export interface SiteDefinition {
  readonly id: SiteId;
  readonly name: string;
  readonly region: string;
  readonly pricePerHaCents: number;
  readonly drainage: number;
  readonly sunlight: number;
  readonly fertility: number;
  readonly altitudeM: number;
  readonly prestige: number;
}

export interface Vineyard {
  readonly id: string;
  readonly name: string;
  readonly siteId: SiteId;
  readonly grapeId: GrapeId;
  readonly areaHa: number;
  readonly plantedYear: number;
  readonly cropYear: number;
  readonly ripeness: number;
  readonly condition: number;
  readonly cropKg: number;
  readonly harvestedKg: number;
  readonly rot: number;
  readonly nobleRot: number;
}

export interface Weather {
  readonly temperatureC: number;
  readonly rainMm: number;
  readonly humidity: number;
}

export interface EstateState {
  readonly vineyards: readonly Vineyard[];
  readonly weather: Weather;
}
