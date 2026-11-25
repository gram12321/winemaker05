// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCompanyState } from '../../src/game/core/CompanyState';

vi.mock('../../src/scene/SceneCanvas', () => ({
  SceneCanvas: ({ scene, visuals, onSelect }: {
    scene: string;
    visuals?: { calendar: { season: number; week: number }; vineyards: readonly unknown[] };
    onSelect: (id: string) => void;
  }) => createElement('button', {
    type: 'button',
    'data-testid': `scene-${scene}`,
    'data-season': visuals?.calendar.season,
    'data-week': visuals?.calendar.week,
    'data-vineyards': visuals?.vineyards.length,
    'aria-label': `${scene} scene hotspot`,
    onClick: () => onSelect(scene === 'estate' ? 'estate-building' : scene === 'winery' ? 'winery-work' : scene === 'cellar' ? 'cellar-shelves' : 'company-milestones'),
  }, 'Scene hotspot'),
}));

import App from '../../src/App';

afterEach(cleanup);

function company() {
  const result = createCompanyState({
    rules: { weeksPerSeason: 8, seasonsPerYear: 3 },
    initialDate: { year: 7, season: 2, week: 5 },
  });
  if (result.kind !== 'created') throw new Error(result.reasons.join(' '));
  return result.state;
}

function focusedPanel(name: string) {
  const element = document.querySelector<HTMLElement>(`[data-game-focus="${name}"]`);
  expect(element).not.toBeNull();
  expect(document.activeElement).toBe(element);
}

describe('connected scene navigation', () => {
  it('opens actual game panels from keyboard-accessible scene destinations', async () => {
    const user = userEvent.setup();
    const state = company();
    render(<App company={state} calendar={state.calendar} canAdvance onAdvance={() => {}} onCommand={() => {}} />);

    expect(screen.getByText('Year 7 · Season 2 · Week 5 of 8 (3 seasons/year)')).toBeTruthy();
    screen.getByRole('button', { name: 'Open Establish a vineyard' }).focus();
    await user.keyboard('{Enter}');
    focusedPanel('estate-establish');

    await user.click(screen.getByRole('button', { name: 'Open Production' }));
    focusedPanel('winery-lots');
    expect(screen.getByRole('heading', { name: 'Production room' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Open Harvest work' }));
    focusedPanel('estate-work');

    await user.click(screen.getByRole('button', { name: 'Open Production' }));
    await user.click(screen.getByRole('button', { name: 'Open Vessel equipment' }));
    focusedPanel('management-equipment');
    expect(screen.getByRole('heading', { name: 'Equipment' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Cellar' }));
    await user.click(screen.getByRole('button', { name: 'Open Bottled wines' }));
    focusedPanel('cellar-bottles');

    await user.click(screen.getByRole('button', { name: 'Company' }));
    await user.click(screen.getByRole('button', { name: 'Open Sales and history' }));
    focusedPanel('company-history');
  });

  it('routes canvas hotspots through the same navigation map and reflects configured state', async () => {
    const user = userEvent.setup();
    const state = company();
    render(<App company={state} calendar={state.calendar} canAdvance onAdvance={() => {}} onCommand={() => {}} />);

    const estateCanvas = screen.getByTestId('scene-estate');
    expect(estateCanvas.getAttribute('data-season')).toBe('2');
    expect(estateCanvas.getAttribute('data-week')).toBe('5');
    expect(estateCanvas.getAttribute('data-vineyards')).toBe('0');

    await user.click(screen.getByRole('button', { name: 'estate scene hotspot' }));
    expect(screen.getByRole('heading', { name: 'Production room' })).toBeTruthy();
    focusedPanel('winery-lots');
  });
});
