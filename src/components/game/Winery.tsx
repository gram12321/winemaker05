import { FermentationForm, PressForm } from './LotActions';
import { ContextScene, decimal, Empty, quantity, type GameProps } from './common';

export function Winery(props: GameProps) {
  const { view } = props;
  const sceneSelection = props.selectedSceneObject ?? null;
  const onSceneSelect = props.onSceneObjectSelect ?? (() => {});
  return <div className="game-stack" data-game-focus="winery-lots" tabIndex={-1}><div className="game-banner game-banner-scene"><div><span className="eyebrow">FROM HARVEST TO WINE</span><h2>Production room</h2><p>Press harvested grapes, then manage fermentation and contact as the lot develops. Use the cellar for transfers, bottling and its full history.</p></div><ContextScene scene="winery" view={view} selected={sceneSelection} onSelect={onSceneSelect} /></div>
    {!view.lots.length ? <Empty>Harvest a vineyard to bring grapes into the production room.</Empty> : <div className="game-grid">{view.lots.map(row => <article className="game-card" key={row.lot.id}><div className="game-card-heading"><div><span className="eyebrow">{row.lot.form.toUpperCase()} · {row.lot.origin.vintage}</span><h3>{row.lot.name}</h3></div><span className="game-tag">{quantity(row.holding.quantity, row.holding.unit)}</span></div><p>{row.status} · {row.vesselName}</p><p>Sugar {decimal(row.lot.physical.sugarGPerL)} g/L · Alcohol {decimal(row.lot.physical.alcoholPct)} %</p>{row.lot.form === 'grapes' && <PressForm row={row} {...props} />}{(row.lot.form === 'must' || row.lot.form === 'wine') && <FermentationForm row={row} {...props} />}{row.lot.form === 'bottled' && <p>Find bottling history and sales in the cellar.</p>}</article>)}</div>}
  </div>;
}
