import type { Holding } from '../inventory/types';
import type { Vessel } from '../equipment/types';
import type { PhysicalLot } from '../wine/types';
import { resolveWineEnvironment } from '../equipment/Rules';
import { developLot } from '../wine/Development';

/** Re-resolve storage daily so completion hands temperature control back to the cellar. */
export function developStoredLot(input: {
  readonly lot: PhysicalLot;
  readonly holding: Holding;
  readonly vessel: Vessel | null;
  readonly cellarTemperatureC: number;
  readonly occupiedMl: number;
  readonly days: number;
}): { readonly lot: PhysicalLot; readonly causes: readonly string[] } {
  if (!Number.isSafeInteger(input.days) || input.days < 0) throw new RangeError('Stored development days must be a non-negative safe integer.');
  return developLot(
    input.lot,
    lot => resolveWineEnvironment(lot, input.holding, input.vessel, input.cellarTemperatureC, input.occupiedMl),
    input.days,
  );
}
