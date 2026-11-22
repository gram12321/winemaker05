import { describe, expect, it } from 'vitest';
import { apply, createBottledScenario } from '../helpers/CoreScenario';
import { decideCommand } from '../../src/game/core/decideCommand';
import { readCompanyState, type CompanyState } from '../../src/game/core/CompanyState';
import { CompanySession } from '../../src/authority/session';
import { InMemorySave } from '../authority/inMemorySave';

function contracted() {
  const scenario = createBottledScenario();
  const contract = scenario.state.commercial.contracts.find(c => c.buyerId === 'local-merchant' && c.status === 'offered')!;
  if (!contract) throw new Error('No current merchant offer.');
  return { ...scenario, contract, state: apply(scenario.state, { type: 'contract.accept', contractId: contract.id }) };
}

function withBuyerBottleCount(state: CompanyState, buyerId: string, bottlesBought: number): CompanyState {
  const candidate = {
    ...state,
    commercial: {
      ...state.commercial,
      customers: state.commercial.customers.map(customer => customer.id === buyerId
        ? { ...customer, bottlesBought }
        : customer),
    },
  };
  const checked = readCompanyState(candidate);
  if (checked.kind === 'invalid') throw new Error(checked.reasons.join(' '));
  return checked.state;
}

describe('cross-domain material and commercial transactions', () => {
  it('splits and reblends liquid with conserved material, archived ancestry and reusable source capacity', () => {
    const scenario = createBottledScenario();
    let state = apply(scenario.state, { type: 'vessel.buy', material: 'oak', capacityLitres: 100 });
    const vessel = state.equipment.vessels.find(v => v.id !== 'starter-tank')!;
    const volume = state.inventory.holdings.find(h => h.lotId === scenario.bulkId)!.quantity;
    const source = state.winery.lots.find(l => l.id === scenario.bulkId)!;
    state = apply(state, { type: 'wine.split', lotId: source.id, quantity: 1000, vesselId: vessel.id });
    const child = state.winery.lots.find(l => l.parentIds.includes(source.id) && l.form === 'wine')!;
    expect(state.inventory.holdings.filter(h => h.unit === 'ml').reduce((sum, h) => sum + h.quantity, 0)).toBe(volume);
    expect(decideCommand(state, { type: 'wine.transfer', lotId: source.id, vesselId: vessel.id }).kind).toBe('rejected');
    state = apply(state, { type: 'wine.blend', lotIds: [child.id, source.id], vesselId: 'starter-tank', name: 'Recombined estate wine' });
    const blended = state.winery.lots.find(l => l.name === 'Recombined estate wine')!;
    expect(state.inventory.holdings.find(h => h.lotId === blended.id)?.quantity).toBe(volume);
    for (const key of Object.keys(source.anchors) as (keyof typeof source.anchors)[]) expect(blended.anchors[key]).toBeCloseTo(source.anchors[key], 12);
    for (const key of Object.keys(source.physical) as (keyof typeof source.physical)[]) expect(blended.physical[key]).toBeCloseTo(source.physical[key], 12);
    expect(blended.history).toHaveLength(2);
    expect(blended.parentIds).toEqual([source.id, child.id].sort());
    expect(state.winery.archivedLots.filter(l => [source.id, child.id].includes(l.id))).toHaveLength(2);
    expect(readCompanyState(state).kind).toBe('valid');
  });

  it('protects reservations and delivers multiple portions atomically at fixed terms', () => {
    const scenario = contracted();
    let state = apply(scenario.state, { type: 'wine.split', lotId: scenario.bottledId, quantity: 10, vesselId: null });
    const child = state.winery.lots.find(l => l.form === 'bottled' && l.id !== scenario.bottledId)!;
    state = apply(state, { type: 'contract.reserve', contractId: scenario.contract.id, lotId: child.id, bottles: 10 });
    state = apply(state, { type: 'contract.reserve', contractId: scenario.contract.id, lotId: scenario.bottledId, bottles: scenario.contract.bottles - 10 });
    const before = structuredClone(state);
    expect(decideCommand(state, { type: 'wine.sell', lotId: scenario.bottledId, buyerId: 'local-merchant', bottles: 90 }).kind).toBe('rejected');
    expect(decideCommand(state, { type: 'wine.discard', lotId: child.id, quantity: 1 }).kind).toBe('rejected');
    expect(decideCommand(state, { type: 'wine.split', lotId: scenario.bottledId, quantity: 1, vesselId: null }).kind).toBe('rejected');
    expect(state).toEqual(before);
    const next = apply(state, { type: 'contract.fulfill', contractId: scenario.contract.id });
    expect(next.finance.cashCents - state.finance.cashCents).toBe(scenario.contract.pricePerBottleCents * scenario.contract.bottles);
    expect(next.commercial.sales).toHaveLength(2);
    expect(next.commercial.customers[0].bottlesBought).toBe(scenario.contract.bottles);
    expect(next.inventory.holdings.filter(h => h.unit === 'bottle').reduce((sum, h) => sum + h.quantity, 0)).toBe(100 - scenario.contract.bottles);
    expect(next.inventory.reservations).toEqual([]);
    expect(decideCommand(next, { type: 'contract.fulfill', contractId: scenario.contract.id }).kind).toBe('rejected');
  });

  it('rejects a direct sale that would overflow the buyer counter without committing or reserving a receipt', async () => {
    const scenario = createBottledScenario();
    const state = withBuyerBottleCount(scenario.state, 'local-merchant', Number.MAX_SAFE_INTEGER);
    expect(readCompanyState(state).kind).toBe('valid');
    const before = structuredClone(state);
    const command = { type: 'wine.sell' as const, lotId: scenario.bottledId, buyerId: 'local-merchant' as const, bottles: 1 };
    const decision = decideCommand(state, command);
    expect(decision.kind).toBe('rejected');
    if (decision.kind === 'rejected') expect(decision.reasons.join(' ')).toContain('customer bottle total exceeds supported whole-bottle precision');
    expect(state).toEqual(before);

    const saves = new InMemorySave();
    saves.seed('counter-company', state);
    const session = new CompanySession(saves, () => 'counter-sale-attempt');
    expect((await session.switchCompany('counter-company')).kind).toBe('loaded');
    const envelope = { companyId: 'counter-company', commandId: 'counter-sale', expectedRevision: 0, command };
    expect((await session.dispatch(envelope)).kind).toBe('rejected');
    expect((await session.dispatch(envelope)).kind).toBe('rejected');
    expect(session.getSnapshot()?.state).toEqual(before);
    expect(saves.companies.get('counter-company')?.state).toEqual(before);
    expect(saves.receipts.size).toBe(0);
    expect(saves.pending.size).toBe(0);
    expect(saves.writes).toBe(0);
  });

  it('rolls back every lot in a contract when a later delivery line overflows the buyer counter', () => {
    const scenario = contracted();
    let state = apply(scenario.state, { type: 'wine.split', lotId: scenario.bottledId, quantity: 10, vesselId: null });
    const child = state.winery.lots.find(lot => lot.form === 'bottled' && lot.id !== scenario.bottledId)!;
    state = apply(state, { type: 'contract.reserve', contractId: scenario.contract.id, lotId: child.id, bottles: 10 });
    state = apply(state, { type: 'contract.reserve', contractId: scenario.contract.id, lotId: scenario.bottledId, bottles: scenario.contract.bottles - 10 });

    const reservations = state.inventory.reservations.filter(reservation => reservation.contractId === scenario.contract.id)
      .sort((a, b) => a.lotId.localeCompare(b.lotId));
    expect(reservations).toHaveLength(2);
    const firstLineCount = reservations[0].bottles;
    state = withBuyerBottleCount(state, scenario.contract.buyerId, Number.MAX_SAFE_INTEGER - firstLineCount);
    expect(readCompanyState(state).kind).toBe('valid');
    expect(state.commercial.customers.find(customer => customer.id === scenario.contract.buyerId)?.bottlesBought)
      .toBe(Number.MAX_SAFE_INTEGER - firstLineCount);
    const before = structuredClone(state);

    const decision = decideCommand(state, { type: 'contract.fulfill', contractId: scenario.contract.id });
    expect(decision.kind).toBe('rejected');
    if (decision.kind === 'rejected') expect(decision.reasons.join(' ')).toContain('customer bottle total exceeds supported whole-bottle precision');
    expect(state).toEqual(before);
  });

  it('releases reservations at a missed deadline and applies default once', () => {
    const scenario = contracted();
    let state = apply(scenario.state, { type: 'contract.reserve', contractId: scenario.contract.id, lotId: scenario.bottledId, bottles: scenario.contract.bottles });
    while (state.week <= scenario.contract.dueWeek) state = apply(state, { type: 'time.advance' });
    expect(state.commercial.contracts.find(c => c.id === scenario.contract.id)?.status).toBe('defaulted');
    expect(state.inventory.reservations).toEqual([]);
    expect(state.commercial.sales).toEqual([]);
    const relationship = state.commercial.customers[0].relationship;
    const next = apply(state, { type: 'time.advance' });
    expect(next.commercial.customers[0].relationship).toBe(relationship);
    expect(next.inventory.holdings.find(h => h.lotId === scenario.bottledId)?.quantity).toBe(100);
  });

  it('recovers a lost contract receipt without repeating stock or money', async () => {
    const scenario = contracted();
    const state = apply(scenario.state, { type: 'contract.reserve', contractId: scenario.contract.id, lotId: scenario.bottledId, bottles: scenario.contract.bottles });
    const saves = new InMemorySave();
    saves.seed('contract-company', state);
    const session = new CompanySession(saves, () => 'delivery-attempt');
    await session.switchCompany('contract-company');
    const envelope = { companyId: 'contract-company', commandId: 'delivery', expectedRevision: 0, command: { type: 'contract.fulfill' as const, contractId: scenario.contract.id } };
    saves.nextCommit = 'commit-then-unknown';
    expect((await session.dispatch(envelope)).kind).toBe('unknown');
    expect((await session.resolve()).kind).toBe('committed');
    expect((await session.dispatch(envelope)).kind).toBe('already-committed');
    const saved = saves.companies.get('contract-company')!.state;
    expect(saved.commercial.sales).toHaveLength(1);
    expect(saved.finance.postings.filter(p => p.category === 'contract')).toHaveLength(1);
    expect(saved.inventory.holdings.find(h => h.lotId === scenario.bottledId)?.quantity).toBe(100 - scenario.contract.bottles);
  });
});
