import { advanceTime } from '../simulation/AdvanceTime';
import type { GameCommand } from './Commands';
import type { CompanyState } from './CompanyState';
import type { CommandDecision } from './Results';

/** Evaluate a command synchronously, without I/O or changes to the input snapshot. */
export function decideCommand(state: CompanyState, command: GameCommand): CommandDecision {
  if (
    typeof command !== 'object' || command === null || Array.isArray(command) ||
    command.type !== 'time.advance' || Object.keys(command).length !== 1 ||
    !Object.hasOwn(command, 'type')
  ) {
    return { kind: 'rejected', reasons: Object.freeze(['Unsupported command.']) };
  }
  return advanceTime(state);
}
