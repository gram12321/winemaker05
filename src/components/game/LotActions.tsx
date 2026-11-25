import { useState } from 'react';
import { blendDestinations, pressDestinations, previewCommand, splitDestinations, transferDestinations, type ActionPreview, type PressActionPreview } from '../../game/queries/ActionPreviews';
import { saleQuote } from '../../game/queries/CompanyView';
import type { CellarLotView } from '../../game/queries/CompanyView';
import type { BuyerId } from '../../game/commercial/types';
import type { Vessel } from '../../game/equipment/types';
import { buyerName, decimal, integer, money, percent, percentage, quantity, type GameProps } from './common';

type Destination<Preview extends ActionPreview = ActionPreview> = { vessel: Vessel | null; preview: Preview };

function chooseDestination<Preview extends ActionPreview>(destinations: readonly Destination<Preview>[], selected: string): Destination<Preview> | undefined {
  return destinations.find(item => item.vessel?.id === selected && item.preview.allowed) ?? destinations.find(item => item.preview.allowed);
}

function DestinationSelect({ label, destinations, chosen, onChange }: { label: string; destinations: readonly Destination[]; chosen?: Destination; onChange: (id: string) => void }) {
  return <label>{label}<select value={chosen?.vessel?.id ?? ''} onChange={event => onChange(event.target.value)}>
    {!chosen && <option value="">No usable vessel</option>}
    {destinations.map(({ vessel, preview }) => vessel && <option key={vessel.id} value={vessel.id} disabled={!preview.allowed}>{vessel.name}{preview.allowed ? '' : ` — ${preview.reasons.join(' ')}`}</option>)}
  </select></label>;
}

function Reasons({ preview }: { preview?: ActionPreview }) {
  return preview && !preview.allowed ? <p className="game-warning">{preview.reasons.join(' ')}</p> : null;
}

function NoDestinationReasons({ destinations, chosen }: { destinations: readonly Destination[]; chosen?: Destination }) {
  if (chosen) return null;
  return <p className="game-warning">{destinations.length ? destinations.map(item => `${item.vessel?.name ?? 'Storage'}: ${item.preview.reasons.join(' ')}`).join(' ') : 'No vessels available. Buy equipment first.'}</p>;
}

export function PressForm({ row, company, disabled, onCommand }: { row: CellarLotView } & GameProps) {
  const [intensity, setIntensity] = useState(0.5);
  const [destem, setDestem] = useState(true);
  const [skinContact, setSkinContact] = useState(false);
  const [vesselId, setVesselId] = useState('');
  const destinations = pressDestinations(company, row.lot.id, intensity, destem, skinContact);
  const chosen = chooseDestination<PressActionPreview>(destinations, vesselId);
  const outcome = chosen?.preview.allowed ? chosen.preview.outcome : null;
  return <form className="game-form" onSubmit={event => { event.preventDefault(); if (chosen?.vessel) onCommand({ type: 'wine.press', lotId: row.lot.id, vesselId: chosen.vessel.id, intensity, destem, skinContact }); }}>
    <h4>Press grapes</h4><p>Press all {quantity(row.holding.quantity, row.holding.unit)}. Split the lot first to press a portion.{row.pressingCostCents !== null && ` Processing cost: ${money(row.pressingCostCents)}.`}</p>
    <label>Press intensity ({percentage(intensity, 0)})<input type="range" min="0" max="1" step="0.05" value={intensity} onChange={event => setIntensity(Number(event.target.value))} /></label>
    <div className="game-checks"><label><input type="checkbox" checked={destem} onChange={event => setDestem(event.target.checked)} />Destem</label><label><input type="checkbox" checked={skinContact} onChange={event => setSkinContact(event.target.checked)} />Skin contact</label></div>
    <DestinationSelect label="Press into" destinations={destinations} chosen={chosen} onChange={setVesselId} /><NoDestinationReasons destinations={destinations} chosen={chosen} />
    {outcome && <p aria-label="Press outcome preview">Press preview: expected yield {quantity(outcome.juiceMl, 'ml')} juice · {decimal(outcome.extractedPhenolics, 3)} phenolics extracted · +{decimal(outcome.greenCharacterAdded, 3)} green character · +{decimal(outcome.oxygenExposureAdded, 3)} oxygen exposure</p>}
    <button disabled={disabled || !chosen}>Press grapes</button>
  </form>;
}

export function FermentationForm({ row, company, disabled, onCommand }: { row: CellarLotView } & GameProps) {
  const [temperatureC, setTemperature] = useState(row.lot.processes.temperatureC);
  const [skinContact, setSkinContact] = useState(row.lot.processes.skinContact);
  const [leesContact, setLeesContact] = useState(row.lot.processes.leesContact);
  const command = { type: 'wine.ferment' as const, lotId: row.lot.id, temperatureC, skinContact, leesContact };
  const preview = previewCommand(company, command);
  return <form className="game-form" onSubmit={event => { event.preventDefault(); onCommand(command); }}>
    <h4>Fermentation &amp; contact</h4><p>Sugar {decimal(row.lot.physical.sugarGPerL)} g/L · Alcohol {decimal(row.lot.physical.alcoholPct)} % · Yeast {percent(row.lot.physical.yeastActivity)}</p>
    <label>Fermentation temperature (°C)<input type="number" min="2" max="40" step="0.5" value={temperatureC} onChange={event => setTemperature(Number(event.target.value))} /></label>
    <div className="game-checks"><label><input type="checkbox" checked={skinContact} onChange={event => setSkinContact(event.target.checked)} />Skin contact</label><label><input type="checkbox" checked={leesContact} onChange={event => setLeesContact(event.target.checked)} />Lees contact</label></div>
    <Reasons preview={preview} /><button disabled={disabled || !preview.allowed}>{row.fermentationActionLabel}</button>
  </form>;
}

function TransferForm({ row, company, disabled, onCommand }: { row: CellarLotView } & GameProps) {
  const [vesselId, setVesselId] = useState('');
  const destinations = transferDestinations(company, row.lot.id);
  const chosen = chooseDestination(destinations, vesselId);
  return <form className="game-form" onSubmit={event => { event.preventDefault(); if (chosen?.vessel) onCommand({ type: 'wine.transfer', lotId: row.lot.id, vesselId: chosen.vessel.id }); }}>
    <h4>Transfer lot</h4><DestinationSelect label="Destination" destinations={destinations} chosen={chosen} onChange={setVesselId} /><NoDestinationReasons destinations={destinations} chosen={chosen} />
    <button disabled={disabled || !chosen}>Transfer</button>
  </form>;
}

function SplitForm({ row, company, disabled, onCommand }: { row: CellarLotView } & GameProps) {
  const [amount, setAmount] = useState(1);
  const [vesselId, setVesselId] = useState('');
  const destinations = splitDestinations(company, row.lot.id, amount);
  const chosen = chooseDestination(destinations, vesselId);
  return <form className="game-form" onSubmit={event => { event.preventDefault(); if (chosen) onCommand({ type: 'wine.split', lotId: row.lot.id, quantity: amount, vesselId: chosen.vessel?.id ?? null }); }}>
    <h4>Split a portion</h4><p>Available: {quantity(row.available, row.holding.unit)}. Enter a whole number of raw units.</p>
    <label>Split amount ({row.holding.unit === 'bottle' ? 'bottles' : row.holding.unit})<input type="number" min="1" step="1" value={amount} onChange={event => setAmount(Number(event.target.value))} /></label>
    {row.holding.unit === 'ml' && <DestinationSelect label="Destination" destinations={destinations} chosen={chosen} onChange={setVesselId} />}
    <NoDestinationReasons destinations={destinations} chosen={chosen} /><button disabled={disabled || !chosen}>Split lot</button>
  </form>;
}

function BottleForm({ row, company, disabled, onCommand }: { row: CellarLotView } & GameProps) {
  const [bottles, setBottles] = useState(1);
  const command = { type: 'wine.bottle' as const, lotId: row.lot.id, bottles };
  const preview = previewCommand(company, command);
  return <form className="game-form" onSubmit={event => { event.preventDefault(); onCommand(command); }}>
    <h4>Bottle wine</h4><p>Maximum: {integer(row.maximumBottles)} whole bottles.{row.maximumBottlingCostCents !== null && ` Cost to bottle the maximum: ${money(row.maximumBottlingCostCents)}.`}</p>
    {!row.bottlingReadiness.ready && <p className="game-warning">{row.bottlingReadiness.reasons.join(' ')}</p>}
    <label>Number of bottles<input type="number" min="1" step="1" value={bottles} onChange={event => setBottles(Number(event.target.value))} /></label>
    <Reasons preview={preview} /><button disabled={disabled || !preview.allowed}>Bottle wine</button>
  </form>;
}

function SellForm({ row, company, view, disabled, onCommand }: { row: CellarLotView } & GameProps) {
  const [buyerId, setBuyerId] = useState<BuyerId>(view.customers[0]?.id ?? 'local-merchant');
  const [bottles, setBottles] = useState(1);
  const command = { type: 'wine.sell' as const, lotId: row.lot.id, buyerId, bottles };
  const preview = previewCommand(company, command);
  const quote = saleQuote(company, row.lot.id, buyerId, bottles);
  return <form className="game-form" onSubmit={event => { event.preventDefault(); onCommand(command); }}>
    <h4>Sell bottles</h4><p>{integer(row.available)} available · {integer(row.reserved)} reserved</p>
    <label>Buyer<select value={buyerId} onChange={event => setBuyerId(event.target.value as BuyerId)}>{view.customers.map(customer => <option key={customer.id} value={customer.id}>{buyerName(customer.id)}</option>)}</select></label>
    <label>Number of bottles<input type="number" min="1" step="1" value={bottles} onChange={event => setBottles(Number(event.target.value))} /></label>
    {quote?.ok && <p>Quote: {money(quote.value.totalCents)} · {money(quote.value.pricePerBottleCents)} per bottle. {quote.value.reasons.join(' ')}</p>}
    {quote && !quote.ok && <p className="game-warning">{quote.reason}</p>}
    <Reasons preview={preview} /><button disabled={disabled || !preview.allowed}>Sell to {buyerName(buyerId)}</button>
  </form>;
}

function DiscardForm({ row, company, disabled, onCommand }: { row: CellarLotView } & GameProps) {
  const [amount, setAmount] = useState(1);
  const command = { type: 'wine.discard' as const, lotId: row.lot.id, quantity: amount };
  const preview = previewCommand(company, command);
  return <details><summary>Discard material</summary><form className="game-form" onSubmit={event => { event.preventDefault(); onCommand(command); }}>
    <p>Discard failed material or a bottling remainder to free its storage. Discarding is permanent and produces no revenue.</p>
    <label>Discard amount ({row.holding.unit})<input type="number" min="1" step="1" value={amount} onChange={event => setAmount(Number(event.target.value))} /></label>
    <Reasons preview={preview} /><button disabled={disabled || !preview.allowed}>Discard material</button>
  </form></details>;
}

export function LotActions({ row, ...props }: { row: CellarLotView } & GameProps) {
  return <div className="game-action-grid">
    {row.lot.form === 'grapes' && <PressForm row={row} {...props} />}
    {(row.lot.form === 'must' || row.lot.form === 'wine') && <><FermentationForm row={row} {...props} /><TransferForm row={row} {...props} /><BottleForm row={row} {...props} /></>}
    {row.lot.form === 'bottled' && <SellForm row={row} {...props} />}
    <SplitForm row={row} {...props} />
    <DiscardForm row={row} {...props} />
  </div>;
}

export function BlendForm({ company, view, disabled, onCommand }: GameProps) {
  const [name, setName] = useState('');
  const [lotIds, setLotIds] = useState<string[]>([]);
  const [vesselId, setVesselId] = useState('');
  const destinations = blendDestinations(company, lotIds, name);
  const chosen = chooseDestination(destinations, vesselId);
  return <form className="game-card game-form" onSubmit={event => { event.preventDefault(); if (chosen?.vessel) onCommand({ type: 'wine.blend', lotIds, vesselId: chosen.vessel.id, name: name.trim() }); }}>
    <h3>Blend whole lots</h3><p>Select unreserved lots of the same liquid form. The full selected lots become a new blend.</p>
    <label>Blend name<input required maxLength={80} value={name} onChange={event => setName(event.target.value)} /></label>
    <fieldset><legend>Source lots</legend><div className="game-checks">{view.lots.length ? view.lots.map(row => <label key={row.lot.id}><input type="checkbox" checked={lotIds.includes(row.lot.id)} onChange={event => setLotIds(current => event.target.checked ? [...current, row.lot.id] : current.filter(id => id !== row.lot.id))} />{row.lot.name} · {row.lot.form} · {quantity(row.available, row.holding.unit)} available</label>) : <span>No live lots yet.</span>}</div></fieldset>
    <DestinationSelect label="Blend into" destinations={destinations} chosen={chosen} onChange={setVesselId} /><NoDestinationReasons destinations={destinations} chosen={chosen} />
    <button disabled={disabled || !chosen}>Create blend</button>
  </form>;
}
