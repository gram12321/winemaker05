export type StructureAxis = 'acidity' | 'aroma' | 'body' | 'spice' | 'sweetness' | 'tannins';
export type StructureProfile = Readonly<Record<StructureAxis, number>>;
export type TasteFamily = 'redFruit' | 'darkFruit' | 'citrus' | 'floral' | 'herbal' | 'earth' | 'oak' | 'aged';
export type TasteProfile = Readonly<Record<TasteFamily, number>>;
export interface AxisTarget {
  readonly low: number;
  readonly high: number;
  readonly weight: number;
  readonly reasons: readonly string[];
}
export type TargetProfile = Readonly<Record<string, AxisTarget>>;
export interface AxisAssessment {
  readonly value: number;
  readonly low: number;
  readonly high: number;
  readonly fit: number;
  readonly weight: number;
  readonly reasons: readonly string[];
}
export interface ProfileAssessment {
  readonly score: number;
  readonly axes: Readonly<Record<string, AxisAssessment>>;
}
export interface WineFault {
  readonly code: string;
  readonly severity: number;
  readonly explanation: string;
}
export interface WineAssessment {
  readonly structure: ProfileAssessment;
  readonly taste: ProfileAssessment;
  readonly quality: number;
  readonly faults: readonly WineFault[];
  readonly descriptors: readonly string[];
}
