import { useState } from 'react';
import { Icon } from '../../Icon';
import { managementSections, type ManagementSection } from '../../experience';
import { contractFulfillment, previewCommand } from '../../game/queries/ActionPreviews';
import { vesselPurchaseQuote } from '../../game/queries/CompanyView';
import type { VesselMaterial } from '../../game/equipment/types';
import { ActivityList, buyerName, decimal, Empty, integer, money, percent, quantity, type GameProps } from './common';

function Finance({ view }: GameProps) {
  return <div className="game-stack"><section className="game-card"><h3>Financial position</h3><dl className="game-metrics"><div><dt>Cash</dt><dd>{money(view.finance.cashCents)}</dd></div><div><dt>Wage arrears</dt><dd>{money(view.finance.wageArrearsCents)}</dd></div><div><dt>Land assets</dt><dd>{money(view.summary.landAssetsCents)}</dd></div><div><dt>Sales revenue</dt><dd>{money(view.summary.totalRevenueCents)}</dd></div></dl>{view.finance.wageArrearsCents > 0 && <p className="game-warning">Outstanding wages block harvest work until paid.</p>}</section>
    <section className="game-card"><h3>Ledger</h3>{view.finance.postings.length ? <div className="game-table-wrap"><table><thead><tr><th>Week</th><th>Entry</th><th>Category</th><th>Amount</th></tr></thead><tbody>{[...view.finance.postings].reverse().map(posting => <tr key={posting.id}><td>{posting.week}</td><td>{posting.description}</td><td>{posting.category}</td><td>{money(posting.amountCents)}</td></tr>)}</tbody></table></div> : <Empty>No entries yet.</Empty>}</section></div>;
}

function Equipment({ company, view, disabled, onCommand }: GameProps) {
  const [material, setMaterial] = useState<VesselMaterial>('steel');
  const [capacityLitres, setCapacity] = useState(2000);
  const [temperatureC, setTemperature] = useState(view.cellarTemperatureC);
  const purchase = vesselPurchaseQuote(material, capacityLitres);
  const buyCommand = { type: 'vessel.buy' as const, material, capacityLitres };
  const buyPreview = previewCommand(company, buyCommand);
  const climateCommand = { type: 'cellar.climate' as const, temperatureC };
  const climatePreview = previewCommand(company, climateCommand);
  return <div className="game-stack"><div className="game-grid"><form className="game-card game-form" onSubmit={event => { event.preventDefault(); onCommand(buyCommand); }}><h3>Buy a vessel</h3><label>Material<select value={material} onChange={event => setMaterial(event.target.value as VesselMaterial)}><option value="steel">Steel</option><option value="oak">Oak</option><option value="concrete">Concrete</option></select></label><label>Capacity (litres)<input type="number" min="1" step="1" value={capacityLitres} onChange={event => setCapacity(Number(event.target.value))} /></label><p>{purchase.ok ? `Cost: ${money(purchase.value.costCents)}` : purchase.reason}</p>{!buyPreview.allowed && <p className="game-warning">{buyPreview.reasons.join(' ')}</p>}<button disabled={disabled || !buyPreview.allowed}>Buy vessel</button></form>
    <form className="game-card game-form" onSubmit={event => { event.preventDefault(); onCommand(climateCommand); }}><h3>Cellar climate</h3><p>Current temperature: {decimal(view.cellarTemperatureC)}°C</p><label>Temperature (°C)<input type="number" min="2" max="35" step="0.5" value={temperatureC} onChange={event => setTemperature(Number(event.target.value))} /></label>{!climatePreview.allowed && <p className="game-warning">{climatePreview.reasons.join(' ')}</p>}<button disabled={disabled || !climatePreview.allowed}>Set cellar temperature</button></form></div>
    <section className="game-card"><h3>Vessels</h3><div className="game-grid">{view.vessels.map(({ vessel, freeMl, occupants }) => { const command = { type: 'vessel.maintain' as const, vesselId: vessel.id }; const preview = previewCommand(company, command); return <article className="game-subcard" key={vessel.id}><strong>{vessel.name}</strong><p>{vessel.material} · {decimal(vessel.capacityMl / 1000)} L capacity · {decimal(freeMl / 1000)} L free</p><p>Condition {percent(vessel.condition)} · {integer(vessel.uses)} uses</p><p>Contents: {occupants.length ? occupants.map(lot => lot.name).join(', ') : 'Empty'}</p>{!preview.allowed && <p className="game-warning">{preview.reasons.join(' ')}</p>}<button disabled={disabled || !preview.allowed} onClick={() => onCommand(command)}>Maintain {vessel.name}</button></article>; })}</div></section></div>;
}

function ReserveForm({ contract, ...props }: { contract: GameProps['view']['contracts'][number] } & GameProps) {
  const { company, view, disabled, onCommand } = props;
  const [lotId, setLotId] = useState('');
  const [bottles, setBottles] = useState(1);
  const selected = view.lots.find(row => row.lot.id === lotId) ?? view.lots.find(row => contract.eligibleLots.includes(row.lot.id));
  const command = { type: 'contract.reserve' as const, contractId: contract.contract.id, lotId: selected?.lot.id ?? '', bottles };
  const preview = previewCommand(company, command);
  return <form className="game-form" onSubmit={event => { event.preventDefault(); onCommand(command); }}><label>Wine to reserve<select value={selected?.lot.id ?? ''} onChange={event => setLotId(event.target.value)}><option value="">Choose an eligible lot</option>{view.lots.map(row => <option key={row.lot.id} value={row.lot.id}>{row.lot.name} · {row.lot.form} · {quantity(row.available, row.holding.unit)} available{contract.eligibleLots.includes(row.lot.id) ? '' : ' · currently ineligible'}</option>)}</select></label><label>Bottles to reserve for this lot<input type="number" min="1" step="1" value={bottles} onChange={event => setBottles(Number(event.target.value))} /></label>{selected && !preview.allowed && <p className="game-warning">{preview.reasons.join(' ')}</p>}<button disabled={disabled || !selected || !preview.allowed}>Reserve bottles</button></form>;
}

function ContractCard({ row, ...props }: { row: GameProps['view']['contracts'][number] } & GameProps) {
  const { company, view, disabled, onCommand } = props;
  const { contract } = row;
  const accept = { type: 'contract.accept' as const, contractId: contract.id };
  const accepted = previewCommand(company, accept);
  const fulfillment = contractFulfillment(company, contract.id);
  const reservations = view.reservations.filter(item => item.contractId === contract.id);
  return <article className="game-card"><div className="game-card-heading"><div><span className="eyebrow">{buyerName(contract.buyerId).toUpperCase()} · DUE WEEK {contract.dueWeek}</span><h3>Wine contract</h3></div><span className="game-tag">{contract.status}</span></div><p>{integer(contract.bottles)} bottles · {money(contract.pricePerBottleCents)} each · {contract.grapeId ? contract.grapeId.replaceAll('-', ' ') : 'Any grape'}</p><p>Minimum structure {percent(contract.minimumStructure)} · taste {percent(contract.minimumTaste)} · age {integer(contract.minimumAgeDays)} days</p><p>{integer(row.reserved)} / {integer(contract.bottles)} bottles reserved</p>
    {contract.status === 'offered' && <>{!accepted.allowed && <p className="game-warning">{accepted.reasons.join(' ')}</p>}<button disabled={disabled || !accepted.allowed} onClick={() => onCommand(accept)}>Accept contract</button></>}
    {contract.status === 'accepted' && <><ReserveForm contract={row} {...props} />{reservations.map(reservation => <p key={reservation.lotId}>{view.lots.find(lot => lot.lot.id === reservation.lotId)?.lot.name ?? reservation.lotId}: {integer(reservation.bottles)} bottles <button type="button" disabled={disabled} onClick={() => onCommand({ type: 'contract.reserve', contractId: contract.id, lotId: reservation.lotId, bottles: 0 })}>Release reservation</button></p>)}{!fulfillment.allowed && <p className="game-warning">{fulfillment.reasons.join(' ')}</p>}<button disabled={disabled || !fulfillment.allowed} onClick={() => onCommand({ type: 'contract.fulfill', contractId: contract.id })}>Fulfill contract</button></>}
  </article>;
}

function Market(props: GameProps) {
  const { view } = props;
  return <div className="game-stack"><section className="game-card"><h3>Buyers</h3><div className="game-grid">{view.customers.map(customer => <div className="game-subcard" key={customer.id}><strong>{buyerName(customer.id)}</strong><p>Relationship {percent(customer.relationship)} · {integer(customer.bottlesBought)} bottles purchased</p></div>)}</div><p>Direct sale quotes and available bottles are shown on each bottled lot in the cellar.</p></section><section><h3>Contracts</h3>{view.contracts.length ? <div className="game-grid">{view.contracts.map(row => <ContractCard key={row.contract.id} row={row} {...props} />)}</div> : <Empty>Contract offers appear as the calendar advances.</Empty>}</section></div>;
}

function People(props: GameProps) {
  return <div className="game-stack"><section className="game-card"><h3>Your people</h3><div className="game-grid">{props.view.work.staff.map(worker => <div className="game-subcard" key={worker.id}><strong>{worker.name}</strong><p>{decimal(worker.kgPerWeek)} kg/week · {decimal(worker.experience)} experience</p></div>)}</div></section><section className="game-card"><h3>Work</h3><ActivityList {...props} /></section></div>;
}

export function GameManagement({ section, onSectionChange, ...props }: { section: ManagementSection; onSectionChange: (section: ManagementSection) => void } & GameProps) {
  const current = managementSections.find(item => item.id === section) ?? managementSections[0];
  return <div className="management-layout"><nav className="management-nav" aria-label="Management sections">{managementSections.map(item => <button key={item.id} type="button" className={item.id === section ? 'is-active' : ''} aria-pressed={item.id === section} onClick={() => onSectionChange(item.id)}><Icon name={item.icon} /><span>{item.label}</span></button>)}</nav><section className="management-page"><div className="management-heading"><div><span className="eyebrow">MANAGEMENT / {current.label.toUpperCase()}</span><h2>{current.label}</h2><p>{current.description}</p></div><span className="management-heading-icon"><Icon name={current.icon} /></span></div><div className="game-management-content" data-game-focus={section === 'equipment' ? 'management-equipment' : undefined} tabIndex={section === 'equipment' ? -1 : undefined}>{section === 'finance' ? <Finance {...props} /> : section === 'equipment' ? <Equipment {...props} /> : section === 'market' ? <Market {...props} /> : <People {...props} />}</div></section></div>;
}
