import type { PhysicalLot } from '../../game/wine/types';
import { buyerName, ContextScene, decimal, Empty, integer, money, percent, percentage, type GameProps } from './common';

function ArchivedLot({ lot }: { lot: PhysicalLot }) {
  return <details className="game-subcard"><summary>{lot.name} · {lot.form} · {lot.origin.vintage}</summary>
    <p>{lot.sources.map(source => `${source.origin.vineyardName} · ${source.origin.grapeId.replaceAll('-', ' ')} (${percentage(source.fraction, 2)})`).join(' / ')}</p>
    {lot.bottling && <p>Bottling snapshot, week {lot.bottling.week}: structure {percent(lot.bottling.structure)} · taste {percent(lot.bottling.taste)} · quality {percent(lot.bottling.quality)}</p>}
    <ol className="game-history">{lot.history.map((entry, index) => <li key={`${entry.week}-${index}`}><strong>Week {entry.week}: {entry.action}</strong> — {entry.detail}</li>)}</ol>
  </details>;
}

export function Company(props: GameProps) {
  const { view } = props;
  const sceneSelection = props.selectedSceneObject ?? null;
  const onSceneSelect = props.onSceneObjectSelect ?? (() => {});
  return <div className="game-stack">
    <div className="game-banner game-banner-scene"><div><span className="eyebrow">YOUR COMPANY</span><h2>A life in wine</h2><p>Your company at a glance, from the growing season through to the wines you have sold.</p></div><ContextScene scene="company" view={view} selected={sceneSelection} onSelect={onSceneSelect} /></div>
    <dl className="game-dashboard" data-game-focus="company-overview" tabIndex={-1}><div><dt>Vineyards</dt><dd>{integer(view.summary.vineyardCount)}</dd></div><div><dt>Live lots</dt><dd>{integer(view.summary.liveLotCount)}</dd></div><div><dt>Bottles in cellar</dt><dd>{integer(view.summary.bottlesInCellar)}</dd></div><div><dt>Sales revenue</dt><dd>{money(view.summary.totalRevenueCents)}</dd></div><div><dt>Commitments</dt><dd>{integer(view.summary.activeCommitments)}</dd></div><div><dt>Cash</dt><dd>{money(view.finance.cashCents)}</dd></div></dl>
    <div className="game-grid" data-game-focus="company-history" tabIndex={-1}>
      <section className="game-card"><h3>Recent sales</h3>{view.sales.length ? <ul className="game-history">{[...view.sales].reverse().map(sale => <li key={sale.id}>Week {sale.week}: {integer(sale.bottles)} bottles to {buyerName(sale.buyerId)} · {money(sale.revenueCents)}{sale.contractId && ' · contract'}</li>)}</ul> : <Empty>Bottle a wine to see buyer quotes in the cellar.</Empty>}</section>
      <section className="game-card"><h3>Lot archive</h3>{view.archivedLots.length ? <div className="game-stack">{view.archivedLots.map(lot => <ArchivedLot key={lot.id} lot={lot} />)}</div> : <Empty>Consumed and sold lots will be recorded here.</Empty>}</section>
    </div>
  </div>;
}
