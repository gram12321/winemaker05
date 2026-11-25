import { scenes, type SceneId, type SceneObjectId } from '../../experience';
import type { CompanyView } from '../../game/queries/CompanyView';
import { SceneCanvas } from '../../scene/SceneCanvas';
import type { SceneVisuals } from '../../scene/sceneVisuals';
import { formatNumber } from '../../shared/numberFormat';
import { sceneNavigation } from './sceneNavigation';

interface SceneExplorerProps {
  scene: SceneId;
  selected: SceneObjectId | null;
  view: CompanyView;
  visuals: SceneVisuals;
  onSelect: (id: SceneObjectId) => void;
}

function sceneStatus(scene: SceneId, view: CompanyView): string {
  const wholeNumber = (value: number) => formatNumber(value, { fractionDigits: 0 });
  const count = (value: number, singular: string, plural = `${singular}s`) => `${wholeNumber(value)} ${value === 1 ? singular : plural}`;
  if (scene === 'estate') {
    return `${count(view.summary.vineyardCount, 'vineyard')} · ${wholeNumber(view.summary.harvestReadyVineyardCount)} with harvestable crop · ${count(view.summary.activeHarvests, 'active harvest')}`;
  }
  if (scene === 'winery') {
    const vessel = view.summary.vesselCount === 1 ? 'vessel' : 'vessels';
    return `${wholeNumber(view.summary.occupiedVesselCount)} of ${wholeNumber(view.summary.vesselCount)} ${vessel} occupied · ${count(view.summary.liveLotCount, 'current lot')}`;
  }
  if (scene === 'cellar') {
    const vessel = view.summary.vesselCount === 1 ? 'vessel' : 'vessels';
    return `${count(view.summary.bottledLotCount, 'bottled lot')} · ${wholeNumber(view.summary.bottlesInCellar)} bottles held · ${count(view.summary.activeLotCount, 'unbottled lot')} · ${wholeNumber(view.summary.occupiedVesselCount)} of ${wholeNumber(view.summary.vesselCount)} ${vessel} contain wine`;
  }
  return `${count(view.summary.vineyardCount, 'vineyard')} · ${count(view.summary.liveLotCount, 'current lot')} · ${count(view.summary.saleCount, 'recorded sale')}`;
}

export function SceneExplorer({ scene, selected, view, visuals, onSelect }: SceneExplorerProps) {
  const definition = scenes[scene];
  const date = view.calendar.date;
  const rules = view.calendar.rules;
  return (
    <div className="game-scene-explorer">
      <div className="game-context-scene">
        <SceneCanvas scene={scene} selected={selected} onSelect={onSelect} visuals={visuals} />
      </div>
      <p className="game-scene-date">
        Year {date.year} · Season {date.season} · Week {date.week} of {rules.weeksPerSeason} ({rules.seasonsPerYear} seasons/year)
      </p>
      <p className="game-scene-status" aria-live="polite">{sceneStatus(scene, view)}</p>
      <nav className="game-scene-shortcuts" aria-label={`${definition.label} scene destinations`}>
        {definition.objects.map(object => {
          const target = sceneNavigation[object.id];
          return (
            <button
              type="button"
              key={object.id}
              aria-label={`Open ${target.label}`}
              aria-pressed={selected === object.id}
              className={selected === object.id ? 'is-selected' : ''}
              onClick={() => onSelect(object.id)}
            >
              <strong>{target.label}</strong>
              <small>{target.description}</small>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
