export type VesselMaterial = 'steel' | 'oak' | 'concrete';
export interface Vessel {
  readonly id: string;
  readonly name: string;
  readonly material: VesselMaterial;
  readonly capacityMl: number;
  readonly condition: number;
  readonly uses: number;
}
export interface EquipmentState {
  readonly vessels: readonly Vessel[];
  readonly cellarTemperatureC: number;
}
