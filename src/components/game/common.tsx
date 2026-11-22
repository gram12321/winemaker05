import { useState } from 'react';
import type { GameCommand } from '../../game/core/Commands';
import type { CompanyState } from '../../game/core/CompanyState';
import type { CompanyView } from '../../game/queries/CompanyView';
import type { SceneId } from '../../experience';
import { SceneCanvas } from '../../scene/SceneCanvas';

export interface GameProps {
  company: CompanyState;
  view: CompanyView;
  disabled: boolean;
  onCommand: (command: GameCommand) => void;
}

export const decimal = (value: number, digits = 1) => value.toLocaleString(undefined, { maximumFractionDigits: digits });
export const percent = (value: number) => `${decimal(value * 100, 0)}/100`;
export const money = (cents: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(cents / 100);
export const buyerName = (id: string) => ({ 'local-merchant': 'Local merchant', restaurant: 'Restaurant', collector: 'Collector' }[id] ?? id);
export const quantity = (value: number, unit: 'g' | 'ml' | 'bottle') => unit === 'g' ? `${decimal(value / 1000, 3)} kg` : unit === 'ml' ? `${decimal(value / 1000, 3)} L` : `${decimal(value, 0)} bottles`;
export const title = (value: string) => value.replace(/([A-Z])/g, ' $1').replace(/^./, character => character.toUpperCase());

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="game-empty">{children}</p>;
}

/** The existing scene is a place illustration; actual actions live in the data panels. */
export function ContextScene({ scene }: { scene: SceneId }) {
  return <div className="game-context-scene" aria-label={`Decorative ${scene} scene`}><SceneCanvas scene={scene} selected={null} onSelect={() => {}} /></div>;
}

function ActivityCard({ activity, view, disabled, onCommand }: { activity: CompanyView['work']['activities'][number] } & Pick<GameProps, 'view' | 'disabled' | 'onCommand'>) {
  const [priority, setPriority] = useState(activity.priority);
  const vineyard = view.vineyards.find(row => row.vineyard.id === activity.vineyardId)?.vineyard;
  const preview = view.workPreview.work.activities.find(item => item.id === activity.id);
  const expected = view.workPreview.outputs.find(item => item.activityId === activity.id);
  return <article className="game-activity">
    <strong>Harvest · {vineyard?.name ?? activity.vineyardId}</strong>
    <progress max={activity.targetKg} value={activity.completedKg} aria-label={`Harvest progress for ${vineyard?.name ?? activity.vineyardId}`} />
    <p>{decimal(activity.completedKg, 3)} / {decimal(activity.targetKg, 3)} kg · Priority {activity.priority}</p>
    <p>{activity.staffIds.map(id => view.work.staff.find(worker => worker.id === id)?.name ?? id).join(', ')}</p>
    {preview?.blockedReason ? <p className="game-warning">{preview.blockedReason}</p> : expected ? <p>Next week estimate: {decimal(expected.kilograms, 3)} kg under current conditions.</p> : activity.blockedReason && <p className="game-warning">{activity.blockedReason}</p>}
    <form className="game-inline" onSubmit={event => { event.preventDefault(); onCommand({ type: 'harvest.priority', activityId: activity.id, priority }); }}>
      <label>Priority<input type="number" min="0" step="1" value={priority} onChange={event => setPriority(Number(event.target.value))} /></label>
      <button disabled={disabled}>Set priority</button>
      <button type="button" disabled={disabled} onClick={() => onCommand({ type: 'harvest.cancel', activityId: activity.id })}>Cancel harvest</button>
    </form>
  </article>;
}

export function ActivityList({ view, disabled, onCommand }: Pick<GameProps, 'view' | 'disabled' | 'onCommand'>) {
  if (!view.work.activities.length) return <Empty>No active work. Start a harvest from a vineyard when its crop is ready.</Empty>;
  return <div className="game-stack">{view.work.activities.map(activity => <ActivityCard key={activity.id} activity={activity} view={view} disabled={disabled} onCommand={onCommand} />)}</div>;
}
