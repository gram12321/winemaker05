import type { GrapeId, SiteId } from '../vineyard/types';
import type { VesselMaterial } from '../equipment/types';
import type { BuyerId } from '../commercial/types';

export type GameCommand =
  | { readonly type: 'time.advance' }
  | { readonly type: 'vineyard.establish'; readonly name: string; readonly siteId: SiteId; readonly grapeId: GrapeId; readonly areaHa: number }
  | { readonly type: 'harvest.start'; readonly vineyardId: string; readonly kilograms: number; readonly staffIds: readonly string[] }
  | { readonly type: 'harvest.cancel'; readonly activityId: string }
  | { readonly type: 'harvest.priority'; readonly activityId: string; readonly priority: number }
  | { readonly type: 'vessel.buy'; readonly material: VesselMaterial; readonly capacityLitres: number }
  | { readonly type: 'vessel.maintain'; readonly vesselId: string }
  | { readonly type: 'wine.press'; readonly lotId: string; readonly vesselId: string; readonly intensity: number; readonly destem: boolean; readonly skinContact: boolean }
  | { readonly type: 'wine.ferment'; readonly lotId: string; readonly temperatureC: number; readonly skinContact: boolean; readonly leesContact: boolean }
  | { readonly type: 'wine.transfer'; readonly lotId: string; readonly vesselId: string }
  | { readonly type: 'wine.split'; readonly lotId: string; readonly quantity: number; readonly vesselId: string | null }
  | { readonly type: 'wine.blend'; readonly lotIds: readonly string[]; readonly vesselId: string; readonly name: string }
  | { readonly type: 'wine.bottle'; readonly lotId: string; readonly bottles: number }
  | { readonly type: 'wine.discard'; readonly lotId: string; readonly quantity: number }
  | { readonly type: 'cellar.climate'; readonly temperatureC: number }
  | { readonly type: 'wine.sell'; readonly lotId: string; readonly buyerId: BuyerId; readonly bottles: number }
  | { readonly type: 'contract.accept'; readonly contractId: string }
  | { readonly type: 'contract.reserve'; readonly contractId: string; readonly lotId: string; readonly bottles: number }
  | { readonly type: 'contract.fulfill'; readonly contractId: string };

/** Single strict reader used by HTTP, retained intents and the pure router. */
export function readGameCommand(value: unknown): GameCommand | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const number = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v);
  const integer = (v: unknown): boolean => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
  const id = (v: unknown): boolean => typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(v);
  const name = (v: unknown): boolean => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 80;
  const bool = (v: unknown): boolean => typeof v === 'boolean';
  const ids = (v: unknown): boolean => Array.isArray(v) && v.length > 0 && v.length <= 100 && v.every(id) && new Set(v).size === v.length;
  let fields: Readonly<Record<string, (v: unknown) => boolean>>;
  switch (input.type) {
    case 'time.advance': fields = {}; break;
    case 'vineyard.establish': fields = { name, siteId: v => ['hillside', 'riverbend', 'heritage'].includes(v as string), grapeId: v => ['pinot-noir', 'tempranillo', 'sauvignon-blanc', 'chardonnay'].includes(v as string), areaHa: number }; break;
    case 'harvest.start': fields = { vineyardId: id, kilograms: number, staffIds: ids }; break;
    case 'harvest.cancel': fields = { activityId: id }; break;
    case 'harvest.priority': fields = { activityId: id, priority: integer }; break;
    case 'vessel.buy': fields = { material: v => ['steel', 'oak', 'concrete'].includes(v as string), capacityLitres: number }; break;
    case 'vessel.maintain': fields = { vesselId: id }; break;
    case 'wine.press': fields = { lotId: id, vesselId: id, intensity: number, destem: bool, skinContact: bool }; break;
    case 'wine.ferment': fields = { lotId: id, temperatureC: number, skinContact: bool, leesContact: bool }; break;
    case 'wine.transfer': fields = { lotId: id, vesselId: id }; break;
    case 'wine.split': fields = { lotId: id, quantity: integer, vesselId: v => v === null || id(v) }; break;
    case 'wine.blend': fields = { lotIds: ids, vesselId: id, name }; break;
    case 'wine.bottle': fields = { lotId: id, bottles: integer }; break;
    case 'wine.discard': fields = { lotId: id, quantity: integer }; break;
    case 'cellar.climate': fields = { temperatureC: number }; break;
    case 'wine.sell': fields = { lotId: id, buyerId: v => ['local-merchant', 'restaurant', 'collector'].includes(v as string), bottles: integer }; break;
    case 'contract.accept': fields = { contractId: id }; break;
    case 'contract.reserve': fields = { contractId: id, lotId: id, bottles: integer }; break;
    case 'contract.fulfill': fields = { contractId: id }; break;
    default: return null;
  }
  if (Object.keys(input).length !== Object.keys(fields).length + 1 || !Object.hasOwn(input, 'type') || !Object.entries(fields).every(([key, check]) => Object.hasOwn(input, key) && check(input[key]))) return null;
  return structuredClone(input) as GameCommand;
}
