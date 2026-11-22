// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FermentationForm } from '../../src/components/game/LotActions';
import type { GameCommand } from '../../src/game/core/Commands';
import type { CompanyState } from '../../src/game/core/CompanyState';
import { decideCommand } from '../../src/game/core/decideCommand';
import { companyView } from '../../src/game/queries/CompanyView';
import type { CellarLotView } from '../../src/game/queries/CompanyView';
import { apply, createHarvestedScenario } from '../helpers/CoreScenario';

afterEach(cleanup);

function completedDryWine(): CompanyState {
  let state = createHarvestedScenario().state;
  const grapes = state.winery.lots.find(lot => lot.form === 'grapes');
  if (!grapes) throw new Error('Expected the harvest scenario to produce grapes.');

  state = apply(state, {
    type: 'wine.press', lotId: grapes.id, vesselId: 'starter-tank', intensity: 0.35, destem: true, skinContact: false,
  });
  expect(companyView(state).lots[0]?.fermentationActionLabel).toBe('Start fermentation');

  state = apply(state, { type: 'wine.ferment', lotId: grapes.id, temperatureC: 20, skinContact: false, leesContact: true });
  expect(companyView(state).lots[0]?.fermentationActionLabel).toBe('Update / restart fermentation');
  for (let week = 0; week < 20 && state.winery.lots.find(lot => lot.id === grapes.id)?.processes.fermenting; week += 1) {
    state = apply(state, { type: 'time.advance' });
  }

  const finished = state.winery.lots.find(lot => lot.id === grapes.id);
  if (!finished || finished.form !== 'wine' || finished.processes.fermenting || finished.physical.sugarGPerL > 4) {
    throw new Error('Expected fermentation to finish as dry wine.');
  }
  expect(companyView(state).lots[0]?.fermentationActionLabel).toBe('Configure dry wine settings');
  return state;
}

function FermentationHarness({ initial, onAccepted }: { initial: CompanyState; onAccepted: (state: CompanyState) => void }) {
  const [company, setCompany] = useState(initial);
  const view = companyView(company);
  const row = view.lots[0] as CellarLotView | undefined;
  if (!row) return null;

  const onCommand = (command: GameCommand) => {
    const decision = decideCommand(company, command);
    if (decision.kind !== 'accepted') throw new Error(decision.reasons.join(' '));
    setCompany(decision.next);
    onAccepted(decision.next);
  };
  return <FermentationForm row={row} company={company} view={view} disabled={false} onCommand={onCommand} />;
}

describe('fermentation action', () => {
  it('accepts dry-wine settings without restarting and keeps the query-provided label', async () => {
    const user = userEvent.setup();
    const initial = completedDryWine();
    const initialLot = initial.winery.lots[0]!;
    const onAccepted = vi.fn<(state: CompanyState) => void>();
    render(<FermentationHarness initial={initial} onAccepted={onAccepted} />);

    const button = screen.getByRole('button', { name: 'Configure dry wine settings' });
    const temperature = screen.getByRole('spinbutton');
    await user.clear(temperature);
    await user.type(temperature, '16');
    await user.click(button);

    expect(onAccepted).toHaveBeenCalledTimes(1);
    const updated = onAccepted.mock.calls[0]![0];
    const updatedLot = updated.winery.lots.find(lot => lot.id === initialLot.id)!;
    expect(updatedLot.processes).toMatchObject({ fermenting: false, temperatureC: 16 });
    expect(updatedLot.physical.sugarGPerL).toBe(initialLot.physical.sugarGPerL);
    expect(companyView(updated).lots[0]?.fermentationActionLabel).toBe('Configure dry wine settings');
    expect(screen.getByRole('button', { name: 'Configure dry wine settings' })).toBeTruthy();
  });
});
