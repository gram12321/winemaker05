import type { CompanyState } from '../core/CompanyState';
import type { GameCommand } from '../core/Commands';
import { failure, success, type RuleResult } from '../core/Numbers';
import { createVineyard, MINIMUM_HARVEST_RIPENESS } from '../vineyard/Rules';
import { recordPayment } from './Transactions';

export function estateAction(state: CompanyState, command: GameCommand): RuleResult<CompanyState> {
  switch (command.type) {
    case 'vineyard.establish': {
      const made = createVineyard({ id: `vineyard-${state.sequence}`, name: command.name.trim(), siteId: command.siteId, grapeId: command.grapeId, areaHa: command.areaHa, year: state.calendar.date.year });
      if (!made.ok) return made;
      const paid = recordPayment({ ...state, sequence: state.sequence + 1 }, 'land', -made.value.costCents, `Established ${made.value.vineyard.name}`);
      return paid.ok ? success({ ...paid.value, estate: { ...state.estate, vineyards: [...state.estate.vineyards, made.value.vineyard] } }) : paid;
    }
    case 'harvest.start': {
      const vineyard = state.estate.vineyards.find(v => v.id === command.vineyardId);
      if (!vineyard) return failure('The vineyard does not exist.');
      if (vineyard.ripeness < MINIMUM_HARVEST_RIPENESS) return failure('The crop is not ready to harvest.');
      if (state.work.activities.some(a => a.vineyardId === vineyard.id)) return failure('A harvest is already active for this vineyard.');
      if (!command.staffIds.length || !command.staffIds.every(id => state.work.staff.some(s => s.id === id))) return failure('Assign available staff to the harvest.');
      if (state.finance.wageArrearsCents > 0) return failure('Pay outstanding wages before starting new work.');
      if (!Number.isSafeInteger(Math.round(command.kilograms * 1000)) || command.kilograms <= 0 || Math.abs(command.kilograms * 1000 - Math.round(command.kilograms * 1000)) > 1e-6 || command.kilograms > vineyard.cropKg - vineyard.harvestedKg + 1e-7) return failure('Choose a harvest quantity within the remaining crop, to the nearest gram.');
      return success({ ...state, sequence: state.sequence + 1, work: { ...state.work, activities: [...state.work.activities, { id: `harvest-${state.sequence}`, vineyardId: vineyard.id, targetKg: command.kilograms, completedKg: 0, staffIds: [...command.staffIds], priority: 1, blockedReason: null }] } });
    }
    case 'harvest.cancel': {
      if (!state.work.activities.some(a => a.id === command.activityId)) return failure('The harvest activity does not exist.');
      return success({ ...state, work: { ...state.work, activities: state.work.activities.filter(a => a.id !== command.activityId) } });
    }
    case 'harvest.priority': {
      if (!state.work.activities.some(a => a.id === command.activityId)) return failure('The harvest activity does not exist.');
      return success({ ...state, work: { ...state.work, activities: state.work.activities.map(a => a.id === command.activityId ? { ...a, priority: command.priority } : a) } });
    }
    default: return failure('Unsupported estate command.');
  }
}
