// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fakes = vi.hoisted(() => ({
  apps: [] as Array<{
    resolveInit: () => void;
    destroy: ReturnType<typeof vi.fn>;
    render: ReturnType<typeof vi.fn>;
    rejectInit: (reason?: unknown) => void;
    renderer: { resize: ReturnType<typeof vi.fn> } | undefined;
    stage: { destroy: ReturnType<typeof vi.fn> };
  }>,
  observers: [] as Array<{ disconnect: ReturnType<typeof vi.fn> }>,
  draw: vi.fn(),
  drawings: [] as Array<{ root: object; setSelection: ReturnType<typeof vi.fn>; setVisuals: ReturnType<typeof vi.fn> }>,
}));

vi.mock('pixi.js', () => ({
  Application: class {
    canvas = document.createElement('canvas');
    stage = { addChild: vi.fn(), removeChild: vi.fn(), destroy: vi.fn() };
    renderer = { resize: vi.fn() };
    destroy = vi.fn();
    render = vi.fn();
    stop = vi.fn();
    resolveInit!: () => void;
    rejectInit!: (reason?: unknown) => void;
    init = vi.fn(() => new Promise<void>((resolve, reject) => { this.resolveInit = resolve; this.rejectInit = reject; }));
    constructor() { fakes.apps.push(this); }
  },
}));

vi.mock('../../src/scene/drawScenes', () => ({
  SCENE_WIDTH: 100,
  SCENE_HEIGHT: 100,
  drawScene: (...args: unknown[]) => fakes.draw(...args),
}));

import { SceneCanvas } from '../../src/scene/SceneCanvas';

beforeEach(() => {
  fakes.apps.length = 0;
  fakes.observers.length = 0;
  fakes.drawings.length = 0;
  fakes.draw.mockReset().mockImplementation(() => {
    const drawing = { root: {}, setSelection: vi.fn(), setVisuals: vi.fn() };
    fakes.drawings.push(drawing);
    return drawing;
  });
  vi.stubGlobal('ResizeObserver', class {
    observe = vi.fn();
    disconnect = vi.fn();
    constructor() { fakes.observers.push(this); }
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Pixi scene lifecycle', () => {
  it('destroys a renderer that finishes initializing after its component unmounts', async () => {
    const view = render(<SceneCanvas scene="estate" selected={null} onSelect={() => {}} />);
    const app = fakes.apps[0];
    view.unmount();
    await act(async () => { app.resolveInit(); });
    expect(app.destroy).toHaveBeenCalledOnce();
    expect(app.destroy).toHaveBeenCalledWith({ removeView: true }, { children: true });
    expect(fakes.draw).not.toHaveBeenCalled();
    expect(fakes.observers).toHaveLength(0);
  });

  it('releases the Pixi application when renderer initialization rejects', async () => {
    const view = render(<SceneCanvas scene="estate" selected={null} onSelect={() => {}} />);
    const app = fakes.apps[0];
    await act(async () => { app.rejectInit(new Error('Renderer unavailable')); });

    expect(app.destroy).toHaveBeenCalledOnce();
    expect(app.destroy).toHaveBeenCalledWith({ removeView: true }, { children: true });
    expect(fakes.draw).not.toHaveBeenCalled();
    expect(screen.getByText('The scene is unavailable. Use the places listed below.')).toBeTruthy();
    view.unmount();
    expect(app.destroy).toHaveBeenCalledOnce();
  });

  it('destroys the stage and shows the fallback when initialization rejects before a renderer exists', async () => {
    const view = render(<SceneCanvas scene="estate" selected={null} onSelect={() => {}} />);
    const app = fakes.apps[0];
    app.renderer = undefined;
    await act(async () => { app.rejectInit(new Error('Renderer unavailable')); });

    expect(app.stage.destroy).toHaveBeenCalledOnce();
    expect(app.stage.destroy).toHaveBeenCalledWith({ children: true });
    expect(app.destroy).not.toHaveBeenCalled();
    expect(fakes.draw).not.toHaveBeenCalled();
    expect(screen.getByText('The scene is unavailable. Use the places listed below.')).toBeTruthy();
    view.unmount();
    expect(app.stage.destroy).toHaveBeenCalledOnce();
    expect(app.destroy).not.toHaveBeenCalled();
  });

  it('clears drawing refs and releases Pixi when the first render throws', async () => {
    const initial = {
      calendar: { year: 4, season: 2, week: 3, weeksPerSeason: 8, seasonsPerYear: 3 },
      vineyards: [], activeHarvestCount: 0, vessels: [], bottlesInCellar: 0,
    } as const;
    const refreshed = { ...initial, calendar: { ...initial.calendar, week: 4 } } as const;
    const view = render(<SceneCanvas scene="estate" selected={null} onSelect={() => {}} visuals={initial} />);
    const app = fakes.apps[0];
    app.render.mockImplementationOnce(() => { throw new Error('Render failed'); });
    await act(async () => { app.resolveInit(); });
    const drawing = fakes.drawings[0];

    expect(app.destroy).toHaveBeenCalledOnce();
    expect(screen.getByText('The scene is unavailable. Use the places listed below.')).toBeTruthy();
    view.rerender(<SceneCanvas scene="estate" selected={null} onSelect={() => {}} visuals={refreshed} />);
    expect(drawing.setVisuals).not.toHaveBeenCalled();
    view.unmount();
    expect(app.destroy).toHaveBeenCalledOnce();
  });

  it('uses the latest scene and cleans up correctly across StrictMode remounting', async () => {
    const onSelect = vi.fn();
    const view = render(<StrictMode><SceneCanvas scene="estate" selected={null} onSelect={onSelect} /></StrictMode>);
    expect(fakes.apps).toHaveLength(2);
    view.rerender(<StrictMode><SceneCanvas scene="winery" selected="winery-vessel" onSelect={onSelect} /></StrictMode>);
    await act(async () => { fakes.apps[0].resolveInit(); fakes.apps[1].resolveInit(); fakes.apps[2].resolveInit(); });

    expect(fakes.apps[0].destroy).toHaveBeenCalledOnce();
    expect(fakes.draw).toHaveBeenCalledOnce();
    expect(fakes.draw.mock.calls[0][0]).toBe('winery');
    expect(fakes.observers).toHaveLength(0);
    expect(fakes.apps[2].render).toHaveBeenCalled();
    view.unmount();
    expect(fakes.apps[2].destroy).toHaveBeenCalledOnce();
    expect(fakes.apps[2].destroy).toHaveBeenCalledWith({ removeView: true }, { children: true });
  });

  it('updates an existing drawing from refreshed company visuals without replacing its Pixi application', async () => {
    const initial = {
      calendar: { year: 4, season: 2, week: 3, weeksPerSeason: 8, seasonsPerYear: 3 },
      vineyards: [], activeHarvestCount: 0, vessels: [], bottlesInCellar: 0,
    } as const;
    const refreshed = {
      ...initial,
      vineyards: [{ id: 'vineyard-1', ripeness: 0.8, harvestableKg: 120, harvestedKg: 20 }],
      calendar: { ...initial.calendar, week: 4 },
    } as const;
    const onSelect = vi.fn();
    const view = render(<SceneCanvas scene="estate" selected={null} onSelect={onSelect} visuals={initial} />);
    const app = fakes.apps[0];
    await act(async () => { app.resolveInit(); });
    const drawing = fakes.drawings[0];
    expect(fakes.draw).toHaveBeenCalledWith('estate', expect.any(Function), initial);

    view.rerender(<SceneCanvas scene="estate" selected="estate-parcel" onSelect={onSelect} visuals={refreshed} />);

    expect(fakes.apps).toHaveLength(1);
    expect(drawing.setVisuals).toHaveBeenCalledWith(refreshed);
    expect(drawing.setSelection).toHaveBeenCalledWith('estate-parcel');
    expect(app.render).toHaveBeenCalled();
  });
});
