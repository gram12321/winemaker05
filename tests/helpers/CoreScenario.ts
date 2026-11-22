import type { CompanyState } from '../../src/game/core/CompanyState';
import type { GameCommand } from '../../src/game/core/Commands';
import { decideCommand } from '../../src/game/core/decideCommand';
import { companyStateAt } from './CompanyState';

export function apply(state: CompanyState, command: GameCommand): CompanyState {
  const result = decideCommand(state, command);
  if (result.kind !== 'accepted') throw new Error(`${command.type}: ${result.reasons.join(' ')}`);
  return result.next;
}

/** Public operations only: no forged physical state or direct lifecycle shortcuts. */
export function createHarvestedScenario() {
  let state = apply(companyStateAt(), { type: 'vineyard.establish', name: 'North slope', siteId: 'hillside', grapeId: 'pinot-noir', areaHa: 0.1 });
  for (let weeks = 0; state.estate.vineyards[0].ripeness < 0.9 && weeks < 46; weeks++) state = apply(state, { type: 'time.advance' });
  const vineyard = state.estate.vineyards[0];
  if (vineyard.ripeness < 0.9) throw new Error('The first-year vineyard did not ripen.');
  state = apply(state, { type: 'harvest.start', vineyardId: vineyard.id, kilograms: 200, staffIds: state.work.staff.map(s => s.id) });
  for (let weeks = 0; weeks < 6 && !state.winery.lots.some(lot => lot.form === 'grapes'); weeks++) state = apply(state, { type: 'time.advance' });
  const grapes = state.winery.lots.find(lot => lot.form === 'grapes');
  if (!grapes) throw new Error('Harvest produced no grapes.');
  return { state, lotId: grapes.id, vineyardId: vineyard.id };
}

export function createBottledScenario() {
  const harvested = createHarvestedScenario();
  let state = harvested.state;
  const grapes = state.winery.lots.find(lot => lot.id === harvested.lotId)!;
  state = apply(state, { type: 'wine.press', lotId: grapes.id, vesselId: 'starter-tank', intensity: 0.35, destem: true, skinContact: true });
  state = apply(state, { type: 'wine.ferment', lotId: grapes.id, temperatureC: 20, skinContact: true, leesContact: true });
  for (let weeks = 0; weeks < 20 && state.winery.lots.find(lot => lot.id === grapes.id)?.processes.fermenting; weeks++) state = apply(state, { type: 'time.advance' });
  const wine = state.winery.lots.find(lot => lot.id === grapes.id)!;
  if (wine.form !== 'wine') throw new Error('Managed fermentation did not finish.');
  state = apply(state, { type: 'wine.bottle', lotId: wine.id, bottles: 100 });
  const bottled = state.winery.lots.find(lot => lot.form === 'bottled');
  if (!bottled) throw new Error('Bottling did not create bottles.');
  return { state, bottledId: bottled.id, bulkId: wine.id, vineyardId: harvested.vineyardId };
}
