// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fakes = vi.hoisted(() => ({
  apps: [] as Array<{
    resolveInit: () => void;
    destroy: ReturnType<typeof vi.fn>;
    render: ReturnType<typeof vi.fn>;
  }>,
  observers: [] as Array<{ disconnect: ReturnType<typeof vi.fn> }>,
  draw: vi.fn(),
}));

vi.mock('pixi.js', () => ({
  Application: class {
    canvas = document.createElement('canvas');
    stage = { addChild: vi.fn(), removeChild: vi.fn() };
    renderer = { resize: vi.fn() };
    destroy = vi.fn();
    render = vi.fn();
    resolveInit!: () => void;
    init = vi.fn(() => new Promise<void>((resolve) => { this.resolveInit = resolve; }));
    constructor() { fakes.apps.push(this); }
  },
}));

vi.mock('../../src/scenes/drawScene', () => ({
  SCENE_WIDTH: 100,
  SCENE_HEIGHT: 100,
  drawScene: (...args: unknown[]) => fakes.draw(...args),
}));

import { SceneCanvas } from '../../src/scenes/SceneCanvas';

beforeEach(() => {
  fakes.apps.length = 0;
  fakes.observers.length = 0;
  fakes.draw.mockReset().mockImplementation(() => ({
    container: { scale: { set: vi.fn() }, position: { set: vi.fn() }, destroy: vi.fn() },
    select: vi.fn(),
  }));
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
    const view = render(<SceneCanvas scene="estate" selectedId={null} onSelect={() => {}} />);
    const app = fakes.apps[0];
    view.unmount();
    await act(async () => { app.resolveInit(); });
    expect(app.destroy).toHaveBeenCalledOnce();
    expect(app.destroy).toHaveBeenCalledWith({ removeView: true }, { children: true });
    expect(fakes.draw).not.toHaveBeenCalled();
    expect(fakes.observers).toHaveLength(0);
  });

  it('uses the latest scene and cleans up correctly across StrictMode remounting', async () => {
    const onSelect = vi.fn();
    const view = render(<StrictMode><SceneCanvas scene="estate" selectedId={null} onSelect={onSelect} /></StrictMode>);
    expect(fakes.apps).toHaveLength(2);
    view.rerender(<StrictMode><SceneCanvas scene="winery" selectedId="vessel-one" onSelect={onSelect} /></StrictMode>);
    await act(async () => { fakes.apps[0].resolveInit(); fakes.apps[1].resolveInit(); });

    expect(fakes.apps[0].destroy).toHaveBeenCalledOnce();
    expect(fakes.draw).toHaveBeenCalledOnce();
    expect(fakes.draw.mock.calls[0][0]).toBe('winery');
    expect(fakes.observers).toHaveLength(1);
    expect(fakes.apps[1].render).toHaveBeenCalled();
    view.unmount();
    expect(fakes.observers[0].disconnect).toHaveBeenCalledOnce();
    expect(fakes.apps[1].destroy).toHaveBeenCalledOnce();
    expect(fakes.apps[1].destroy).toHaveBeenCalledWith({ removeView: true }, { children: true });
  });
});
