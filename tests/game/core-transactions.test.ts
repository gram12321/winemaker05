import { describe, expect, it } from 'vitest';
import { apply, createBottledScenario } from '../helpers/CoreScenario';
import { decideCommand } from '../../src/game/core/decideCommand';
import { readCompanyState } from '../../src/game/core/CompanyState';
import { CompanySession } from '../../src/authority/session';
import { InMemorySave } from '../authority/inMemorySave';

function contracted() {
  const scenario = createBottledScenario();
  const contract = scenario.state.commercial.contracts.find(c => c.buyerId === 'local-merchant' && c.status === 'offered')!;
  if (!contract) throw new Error('No current merchant offer.');
  return { ...scenario, contract, state: apply(scenario.state, { type: 'contract.accept', contractId: contract.id }) };
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
