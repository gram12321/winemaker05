// @vitest-environment jsdom
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/ui/App';

// The canvas itself needs a browser renderer; exercise the React interaction
// contract here and verify Pixi rendering separately in a real browser.
vi.mock('../../src/scenes/SceneCanvas', () => ({
  SceneCanvas: ({ scene, onSelect }: { scene: string; onSelect: (id: string) => void }) =>
    createElement('button', {
      type: 'button',
      'data-testid': `scene-${scene}`,
      onClick: () => onSelect('west-parcel'),
    }, 'Scene selection'),
}));

afterEach(cleanup);

describe('prototype navigation', () => {
  it('opens at Estate and shares list and scene selection with the detail panel', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Estate', level: 1 })).toBeTruthy();
    const west = screen.getByRole('button', { name: /West parcel/i });
    expect(west.getAttribute('aria-pressed')).toBe('false');
    west.focus();
    await user.keyboard('{Enter}');
    expect(west.getAttribute('aria-pressed')).toBe('true');
    expect(within(screen.getByLabelText('Feature details')).getByRole('heading', { name: 'West parcel' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Close feature details' }));
    expect(west.getAttribute('aria-pressed')).toBe('false');
    expect(document.activeElement).toBe(west);
    await user.click(screen.getByTestId('scene-estate'));
    expect(west.getAttribute('aria-pressed')).toBe('true');
  });

  it('navigates to each management area and toggles activity without enabling time', async () => {
    const user = userEvent.setup();
    render(<App />);

    const advance = screen.getByRole('button', { name: /Advance time unavailable/i }) as HTMLButtonElement;
    expect(advance.disabled).toBe(true);
    const activity = screen.getByRole('button', { name: 'Activity' });
    await user.click(activity);
    expect(activity.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('heading', { name: 'Activity Manager' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Close Activity Manager' }));
    expect(activity.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(activity);

    await user.click(screen.getByRole('button', { name: 'Management' }));
    for (const name of ['Finance', 'Contracts / Market', 'Equipment', 'People / Work']) {
      await user.click(within(screen.getByLabelText('Management sections')).getByRole('button', { name }));
      expect(screen.getByRole('heading', { name, level: 2 })).toBeTruthy();
    }
  });

  it('opens and closes the cellar detail dialog and resets navigation on remount', async () => {
    const user = userEvent.setup();
    const showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    const close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: showModal });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: close });
    const { unmount } = render(<App />);

    await user.click(screen.getByRole('button', { name: 'Cellar' }));
    await user.click(screen.getByRole('button', { name: 'Wine detail, Wine' }));
    await user.click(screen.getByRole('button', { name: /Open wine detail/i }));
    const dialog = screen.getByRole('dialog', { name: 'The story of a wine' });
    expect(showModal).toHaveBeenCalled();
    fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(close).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Cellar', level: 1 })).toBeTruthy();

    unmount();
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Estate', level: 1 })).toBeTruthy();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  });
});
