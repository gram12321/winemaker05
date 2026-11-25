import { useState } from 'react';
import { vineyardEstablishmentPreview } from '../../game/queries/CompanyView';
import { previewCommand } from '../../game/queries/ActionPreviews';
import type { GrapeId, SiteId } from '../../game/vineyard/types';
import { ActivityList, ContextScene, decimal, Empty, money, percent, percentage, type GameProps } from './common';

function EstablishVineyard({ company, view, disabled, onCommand }: GameProps) {
  const [name, setName] = useState('');
  const [siteId, setSiteId] = useState<SiteId>('hillside');
  const [grapeId, setGrapeId] = useState<GrapeId>('pinot-noir');
  const [areaHa, setAreaHa] = useState(1);
  const establishmentPreview = vineyardEstablishmentPreview(siteId, grapeId, areaHa);
  const command = { type: 'vineyard.establish' as const, name: name.trim(), siteId, grapeId, areaHa };
  const commandPreview = previewCommand(company, command);
  return <form className="game-card game-form" data-game-focus="estate-establish" tabIndex={-1} onSubmit={event => { event.preventDefault(); onCommand(command); }}>
    <span className="eyebrow">GROW SOMETHING DISTINCTIVE</span><h2>Establish a vineyard</h2>
    <label>Vineyard name<input required maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="Name your vineyard" /></label>
    <div className="game-form-grid"><label>Site<select value={siteId} onChange={event => setSiteId(event.target.value as SiteId)}>{view.siteOptions.map(site => <option key={site.id} value={site.id}>{site.name} · {site.region}</option>)}</select></label>
      <label>Grape<select value={grapeId} onChange={event => setGrapeId(event.target.value as GrapeId)}>{view.grapeOptions.map(grape => <option key={grape.id} value={grape.id}>{grape.name}</option>)}</select></label></div>
    <label>Area (hectares)<input type="number" required min="0.01" max="100" step="0.01" value={areaHa} onChange={event => setAreaHa(Number(event.target.value))} /></label>
    {establishmentPreview.ok ? <>
      <dl className="game-metrics" aria-label="Establishment preview">
        <div><dt>Land cost</dt><dd>{money(establishmentPreview.value.costCents)}</dd></div>
        <div><dt>Terroir Potential</dt><dd>{percent(establishmentPreview.value.terroirPotential)}</dd></div>
        <div><dt>Origin Prestige</dt><dd>{percent(establishmentPreview.value.originPrestige)}</dd></div>
      </dl>
      <p>Cash: {money(view.finance.cashCents)}</p>
    </> : <p className="game-warning">{establishmentPreview.reason}</p>}
    {name.trim() && !commandPreview.allowed && <p className="game-warning">{commandPreview.reasons.join(' ')}</p>}
    <button className="game-primary" disabled={disabled || !establishmentPreview.ok || !commandPreview.allowed}>Establish vineyard</button>
  </form>;
}

function VineyardCard({ row, company, view, disabled, onCommand }: { row: GameProps['view']['vineyards'][number] } & GameProps) {
  const [requestedKg, setKilograms] = useState<number | null>(null);
  const [staffIds, setStaffIds] = useState<string[]>(view.work.staff.map(worker => worker.id));
  const { vineyard, grape, site, origin } = row;
  const kilograms = requestedKg ?? row.harvestableKg;
  const command = { type: 'harvest.start' as const, vineyardId: vineyard.id, kilograms, staffIds };
  const preview = previewCommand(company, command);
  return <article className="game-card">
    <div className="game-card-heading"><div><span className="eyebrow">{site.region.toUpperCase()} · {grape.name.toUpperCase()}</span><h3>{vineyard.name}</h3></div><span className="game-tag">{decimal(vineyard.areaHa, 2)} ha</span></div>
    <p>{site.name} · Vintage {vineyard.cropYear}</p>
    <dl className="game-metrics"><div><dt>Terroir Potential</dt><dd>{percent(origin.terroirPotential)}</dd></div><div><dt>Origin Prestige</dt><dd>{percent(origin.originPrestige)}</dd></div><div><dt>Ripeness</dt><dd>{percentage(vineyard.ripeness)}</dd></div><div><dt>Condition</dt><dd>{percentage(vineyard.condition)}</dd></div><div><dt>Harvestable now</dt><dd>{decimal(row.harvestableKg, 3)} kg</dd></div><div><dt>Harvested</dt><dd>{decimal(vineyard.harvestedKg, 3)} kg</dd></div></dl>
    <dl className="game-metrics"><div><dt>Noble rot</dt><dd>{percentage(vineyard.nobleRot)}</dd></div><div><dt>Grey rot</dt><dd>{percentage(vineyard.rot)}</dd></div></dl>
    <form className="game-form" onSubmit={event => { event.preventDefault(); onCommand(command); }}>
      <label>Harvest target (kg)<input type="number" min="0.001" step="0.001" required value={kilograms} onChange={event => setKilograms(Number(event.target.value))} /></label>
      <fieldset><legend>Harvest team</legend><div className="game-checks">{view.work.staff.map(worker => <label key={worker.id}><input type="checkbox" checked={staffIds.includes(worker.id)} onChange={event => setStaffIds(current => event.target.checked ? [...current, worker.id] : current.filter(id => id !== worker.id))} />{worker.name} · {decimal(worker.kgPerWeek)} kg/week</label>)}</div></fieldset>
      {!preview.allowed && <p className="game-warning">{preview.reasons.join(' ')}</p>}
      <button disabled={disabled || !preview.allowed}>Start harvest</button>
    </form>
  </article>;
}

export function Estate(props: GameProps) {
  const { view } = props;
  const sceneSelection = props.selectedSceneObject ?? null;
  const onSceneSelect = props.onSceneObjectSelect ?? (() => {});
  return <div className="game-layout"><div className="game-stack" data-game-focus="estate-vineyards" tabIndex={-1}>
    <div className="game-banner game-banner-scene"><div><span className="eyebrow">THE GROWING SEASON</span><h2>Your vineyards</h2><p>Weather: {decimal(view.weather.temperatureC)}°C · {decimal(view.weather.rainMm)} mm rain · {percentage(view.weather.humidity)} humidity. Harvest receiving: {quantityKg(view.harvestStorageFreeG)} free.</p></div><ContextScene scene="estate" view={view} selected={sceneSelection} onSelect={onSceneSelect} /></div>
    {view.vineyards.length ? view.vineyards.map(row => <VineyardCard key={row.vineyard.id} row={row} {...props} />) : <Empty>Establish a named vineyard to begin growing your first crop.</Empty>}
    <section className="game-card" data-game-focus="estate-work" tabIndex={-1}><h2>Work in progress</h2><ActivityList {...props} /></section>
  </div><EstablishVineyard {...props} /></div>;
}

function quantityKg(grams: number) { return `${decimal(grams / 1000, 3)} kg`; }
