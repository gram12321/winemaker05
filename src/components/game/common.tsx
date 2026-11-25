import { useMemo, useState } from 'react';
import type { GameCommand } from '../../game/core/Commands';
import type { CompanyState } from '../../game/core/CompanyState';
import type { CompanyView } from '../../game/queries/CompanyView';
import type { SceneId, SceneObjectId } from '../../experience';
import type { SceneVisuals } from '../../scene/sceneVisuals';
import { formatEurCents, formatNumber, formatPercent, formatScore } from '../../shared/numberFormat';
import { getRatingColor, getRatingBand, getWineQualityCategory, type RatingDirection } from './ratingPresentation';
import { SceneExplorer } from './SceneExplorer';

export interface GameProps {
  company: CompanyState;
  view: CompanyView;
  disabled: boolean;
  onCommand: (command: GameCommand) => void;
  selectedSceneObject?: SceneObjectId | null;
  onSceneObjectSelect?: (id: SceneObjectId) => void;
}

export const decimal = (value: number, digits = 1) => formatNumber(value, {
  maximumFractionDigits: digits,
  adaptivePrecision: digits > 0,
});
export const integer = (value: number) => formatNumber(value, { fractionDigits: 0 });
export const percent = (value: number) => formatScore(value);
export const percentage = (ratio: number, digits = 1) => formatPercent(ratio, {
  maximumFractionDigits: digits,
  adaptivePrecision: true,
});
export const money = (cents: number) => formatEurCents(cents);

export function RatingValue({ value, meaning = 'higher' }: {
  value: number;
  meaning?: RatingDirection | 'wine-quality';
}) {
  const direction = meaning === 'lower' ? 'lower' : 'higher';
  const color = getRatingColor(value, direction);
  const category = meaning === 'wine-quality' ? getWineQualityCategory(value) : null;
  const formatted = formatScore(value);
  return <span className="game-rating" data-rating-direction={direction} data-rating-band={getRatingBand(value) ?? 'unknown'} aria-label={category ? `${formatted}, ${category}` : formatted} style={color ? { color } : undefined}>
    {formatted}{category && <span className="game-rating-label">{category}</span>}
  </span>;
}

export const buyerName = (id: string) => ({ 'local-merchant': 'Local merchant', restaurant: 'Restaurant', collector: 'Collector' }[id] ?? id);
export const quantity = (value: number, unit: 'g' | 'ml' | 'bottle') => unit === 'g' ? `${decimal(value / 1000, 3)} kg` : unit === 'ml' ? `${decimal(value / 1000, 3)} L` : `${integer(value)} bottles`;
export const title = (value: string) => value.replace(/([A-Z])/g, ' $1').replace(/^./, character => character.toUpperCase());

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="game-empty">{children}</p>;
}

/** The scene illustrates current read-model facts and opens their real game panels. */
export function ContextScene({ scene, view, selected, onSelect }: {
  scene: SceneId;
  view: CompanyView;
  selected: SceneObjectId | null;
  onSelect: (id: SceneObjectId) => void;
}) {
  const visuals = useMemo<SceneVisuals>(() => ({
    calendar: {
      year: view.calendar.date.year,
      season: view.calendar.date.season,
      week: view.calendar.date.week,
      weeksPerSeason: view.calendar.rules.weeksPerSeason,
      seasonsPerYear: view.calendar.rules.seasonsPerYear,
    },
    vineyards: view.vineyards.map(({ vineyard, harvestableKg }) => ({
      ripeness: vineyard.ripeness,
      harvestableKg,
      harvestedKg: vineyard.harvestedKg,
    })),
    activeHarvestCount: view.summary.activeHarvests,
    vessels: view.vessels.map(({ vessel, fillRatio }) => ({
      material: vessel.material,
      fillRatio,
    })),
    bottlesInCellar: view.summary.bottlesInCellar,
  }), [view]);

  return <SceneExplorer scene={scene} selected={selected} view={view} visuals={visuals} onSelect={onSelect} />;
}

function ActivityCard({ activity, view, disabled, onCommand }: { activity: CompanyView['work']['activities'][number] } & Pick<GameProps, 'view' | 'disabled' | 'onCommand'>) {
  const [priority, setPriority] = useState(activity.priority);
  const vineyard = view.vineyards.find(row => row.vineyard.id === activity.vineyardId)?.vineyard;
  const preview = view.workPreview.work.activities.find(item => item.id === activity.id);
  const expected = view.workPreview.outputs.find(item => item.activityId === activity.id);
  return <article className="game-activity">
    <strong>Harvest · {vineyard?.name ?? activity.vineyardId}</strong>
    <progress max={activity.targetKg} value={activity.completedKg} aria-label={`Harvest progress for ${vineyard?.name ?? activity.vineyardId}`} />
    <p>{decimal(activity.completedKg, 3)} / {decimal(activity.targetKg, 3)} kg · Priority {integer(activity.priority)}</p>
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
