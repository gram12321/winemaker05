import type { CompanyState } from '../core/CompanyState';
import type { GameCommand } from '../core/Commands';
import { failure, success, type RuleResult } from '../core/Numbers';
import { vesselPurchase, maintainVessel } from '../equipment/Rules';
import { recordPayment } from './Transactions';

export function equipmentAction(state: CompanyState, command: GameCommand): RuleResult<CompanyState> {
  switch (command.type) {
    case 'vessel.buy': {
      const made = vesselPurchase({ id: `vessel-${state.sequence}`, material: command.material, capacityLitres: command.capacityLitres });
      if (!made.ok) return made;
      const paid = recordPayment({ ...state, sequence: state.sequence + 1 }, 'equipment', -made.value.costCents, `Purchased ${made.value.vessel.name}`);
      return paid.ok ? success({ ...paid.value, equipment: { ...state.equipment, vessels: [...state.equipment.vessels, made.value.vessel] } }) : paid;
    }
    case 'vessel.maintain': {
      const vessel = state.equipment.vessels.find(v => v.id === command.vesselId);
      if (!vessel) return failure('The vessel does not exist.');
      if (state.inventory.holdings.some(h => h.vesselId === vessel.id)) return failure('Transfer the wine before maintaining this vessel.');
      const maintained = maintainVessel(vessel);
      const paid = recordPayment(state, 'equipment', -maintained.costCents, `Maintained ${vessel.name}`);
      return paid.ok ? success({ ...paid.value, equipment: { ...state.equipment, vessels: state.equipment.vessels.map(v => v.id === vessel.id ? maintained.vessel : v) } }) : paid;
    }
    case 'cellar.climate':
      if (command.temperatureC < 2 || command.temperatureC > 35) return failure('Choose a cellar temperature between 2 and 35°C.');
      return success({ ...state, equipment: { ...state.equipment, cellarTemperatureC: command.temperatureC } });
    default: return failure('Unsupported equipment command.');
  }
}
