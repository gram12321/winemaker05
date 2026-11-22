import { useState } from 'react';
import { forecastLot } from '../../game/queries/CompanyView';
import type { ProfileAssessment, WineFault } from '../../game/evaluation/types';
import { BlendForm, LotActions } from './LotActions';
import { ContextScene, decimal, Empty, percent, quantity, title, type GameProps } from './common';

function sourceSummary(sources: GameProps['view']['lots'][number]['originSources']): string {
  return sources.map(({ origin, fraction }) =>
    `${origin.vineyardName} (${origin.grapeId.replaceAll('-', ' ')} ${origin.vintage}, ${decimal(fraction * 100, 1)}%)`,
  ).join(' + ');
}

function Assessment({ label, assessment }: { label: string; assessment: ProfileAssessment }) {
  return <section className="game-assessment"><h4>{label} <strong>{percent(assessment.score)}</strong></h4>
    <dl>{Object.entries(assessment.axes).map(([axis, result]) => <div key={axis}><dt>{title(axis)} <strong>{percent(result.value)}</strong></dt><dd>Target {percent(result.low)}–{percent(result.high)} · Fit {percent(result.fit)}{result.reasons.length > 0 && <details className="game-target-explanation"><summary>Target details</summary><small>{result.reasons.join(' ')}</small></details>}</dd></div>)}</dl>
  </section>;
}

export function Cellar(props: GameProps) {
  const { company, view } = props;
  const [selectedId, setSelectedId] = useState('');
  const selected = view.lots.find(row => row.lot.id === selectedId) ?? view.lots[0];
  const forecast = selected ? forecastLot(company, selected.lot) : null;
  return <div className="game-stack">
    <div className="game-cellar-layout"><section className="game-card"><span className="eyebrow">THE COLLECTION</span><h2>Live lots</h2><ContextScene scene="cellar" />
      {!view.lots.length ? <Empty>Harvest grapes to bring your first lot into the winery.</Empty> : <div className="game-lot-list">{view.lots.map(row => <button key={row.lot.id} type="button" className={selected?.lot.id === row.lot.id ? 'is-selected' : ''} aria-pressed={selected?.lot.id === row.lot.id} onClick={() => setSelectedId(row.lot.id)}><strong>{row.lot.name}</strong><span>{sourceSummary(row.originSources)} · {row.lot.form} · {quantity(row.holding.quantity, row.holding.unit)}</span><small>{row.status}</small></button>)}</div>}
    </section>
    {selected ? <article className="game-card game-wine-detail" key={selected.lot.id}>
      <div className="game-card-heading"><div><span className="eyebrow">LOT DETAIL</span><h2>{selected.lot.name}</h2><p>Sources: {sourceSummary(selected.originSources)} · {selected.vesselName}</p></div><span className="game-tag">{selected.lot.form}</span></div>
      <p className="game-status">{selected.status} · {quantity(selected.holding.quantity, selected.holding.unit)} · {quantity(selected.available, selected.holding.unit)} available{selected.reserved > 0 && ` · ${selected.reserved} reserved`}</p>
      <p className="game-status">Current quality {percent(selected.assessment.quality)}</p>
      <p className="game-note">Quality is based on structure fit, adjusted once for the strongest current physical risk. Taste fit is separate and also informs buyer fit.</p>
      <dl className="game-metrics"><div><dt>Sugar</dt><dd>{decimal(selected.lot.physical.sugarGPerL)} g/L</dd></div><div><dt>Alcohol</dt><dd>{decimal(selected.lot.physical.alcoholPct)}%</dd></div><div><dt>Wine age</dt><dd>{selected.lot.physical.developmentAgeDays} days</dd></div><div><dt>Lot age</dt><dd>{selected.lot.physical.ageDays} days</dd></div><div><dt>Maturation</dt><dd>{decimal(selected.lot.physical.maturation, 2)}</dd></div><div><dt>Oxygen exposure</dt><dd>{decimal(selected.lot.physical.oxygenExposure, 2)}</dd></div><div><dt>Lees / oak</dt><dd>{percent(selected.lot.physical.lees)} / {percent(selected.lot.physical.oak)}</dd></div></dl>
      <div className="game-assessment-grid"><Assessment label="Structure" assessment={selected.assessment.structure} /><Assessment label="Taste fit" assessment={selected.assessment.taste} /></div>
      <div className="game-note"><strong>Tasting notes</strong><p>{selected.assessment.descriptors.length ? selected.assessment.descriptors.join(' · ') : 'No descriptors currently expressed.'}</p><strong>Faults</strong><p>{selected.assessment.faults.length ? selected.assessment.faults.map((fault: WineFault) => `${fault.code} (${percent(fault.severity)}): ${fault.explanation}`).join(' ') : 'No faults currently identified.'}</p></div>
      {forecast && <div className="game-note"><strong>Current-condition forecast · {forecast.trajectory}</strong><p>Projected quality {percent(forecast.quality)} ({forecast.change >= 0 ? '+' : ''}{decimal(forecast.change * 100)} points). {forecast.assumption}</p></div>}
      <details><summary>Readiness, origin &amp; history</summary><div className="game-detail-content"><p><strong>Physical bottling readiness:</strong> {selected.bottlingReadiness.ready ? 'Ready' : selected.bottlingReadiness.reasons.join(' ')}</p><p><strong>Sources:</strong> {sourceSummary(selected.originSources)}</p><ul>{selected.originSources.map(({ origin, fraction }, index) => <li key={`${origin.vineyardId}-${index}`}>{origin.vineyardName} · {origin.region} · {percent(fraction)}: Terroir Potential {percent(origin.terroirPotential)} · Origin Prestige {percent(origin.originPrestige)}</li>)}</ul>{selected.lot.bottling && <p><strong>Bottling snapshot, week {selected.lot.bottling.week}:</strong> structure {percent(selected.lot.bottling.structure)} · taste {percent(selected.lot.bottling.taste)} · quality {percent(selected.lot.bottling.quality)}</p>}<ol className="game-history">{selected.lot.history.map((entry, index) => <li key={`${entry.week}-${index}`}><strong>Week {entry.week}: {entry.action}</strong> — {entry.detail}</li>)}</ol></div></details>
      <details open><summary>Manage this lot</summary><LotActions key={selected.lot.id} row={selected} {...props} /></details>
    </article> : <div className="game-card"><Empty>Select a lot here to inspect its development, assessment and history.</Empty></div>}</div>
    <details><summary>Blend lots</summary><BlendForm {...props} /></details>
  </div>;
}
