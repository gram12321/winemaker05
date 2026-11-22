export interface Worker {
  readonly id: string;
  readonly name: string;
  readonly kgPerWeek: number;
  readonly experience: number;
}
export interface HarvestActivity {
  readonly id: string;
  readonly vineyardId: string;
  readonly targetKg: number;
  readonly completedKg: number;
  readonly staffIds: readonly string[];
  readonly priority: number;
  readonly blockedReason: string | null;
}
export interface WorkState {
  readonly staff: readonly Worker[];
  readonly activities: readonly HarvestActivity[];
}
