import { advanceTime } from '../simulation/AdvanceTime';
import { readGameCommand, type GameCommand } from './Commands';
import { readCompanyState, type CompanyState } from './CompanyState';
import type { CommandDecision } from './Results';
import { estateAction } from '../commands/EstateActions';
import { equipmentAction } from '../commands/EquipmentActions';
import { wineAction } from '../commands/WineActions';
import { commercialAction } from '../commands/CommercialActions';
import type { RuleResult } from './Numbers';

/** Evaluate a command synchronously, without I/O or changes to the input snapshot. */
export function decideCommand(state: CompanyState, command: GameCommand): CommandDecision {
  const parsed = readGameCommand(command);
  if (!parsed) {
    return { kind: 'rejected', reasons: Object.freeze(['Unsupported command.']) };
  }
  const valid = readCompanyState(state);
  if (valid.kind === 'invalid') return { kind: 'rejected', reasons: valid.reasons };
  if (parsed.type === 'time.advance') return advanceTime(valid.state);
  let result: RuleResult<CompanyState>;
  switch (parsed.type) {
    case 'vineyard.establish': case 'harvest.start': case 'harvest.cancel': case 'harvest.priority': result = estateAction(valid.state, parsed); break;
    case 'vessel.buy': case 'vessel.maintain': case 'cellar.climate': result = equipmentAction(valid.state, parsed); break;
    case 'wine.sell': case 'contract.accept': case 'contract.reserve': case 'contract.fulfill': result = commercialAction(valid.state, parsed); break;
    default: result = wineAction(valid.state, parsed); break;
  }
  if (!result.ok) return { kind: 'rejected', reasons: Object.freeze([result.reason]) };
  const next = readCompanyState(result.value);
  return next.kind === 'valid'
    ? { kind: 'accepted', next: next.state, events: Object.freeze([]) }
    : { kind: 'rejected', reasons: next.reasons };
}
