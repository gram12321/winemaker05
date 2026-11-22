import { afterEach, describe, expect, it } from 'vitest';
import { companyOwnerId } from '../../src/shared/companyScope';
import { createBottledScenario } from '../helpers/CoreScenario';
import { startTestAuthority } from '../helpers/TestAuthority';

const authorities: Awaited<ReturnType<typeof startTestAuthority>>[] = [];
afterEach(async () => { for (const authority of authorities.splice(0)) await authority.close(); });

async function running() {
  const authority = await startTestAuthority();
  authorities.push(authority);
  return authority;
}
async function call(origin: string, path: string, body?: unknown) {
  const response = await fetch(`${origin}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'x-winemaker-unassigned': '1', ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

describe('production inventory through the HTTP company authority', () => {
  it('creates a full current-schema company through the existing public creation flow', async () => {
    const { origin } = await running();
    expect((await call(origin, '/companies', { companyId: 'fresh-game-company', name: 'Fresh winery' })).status).toBe(201);
    const loaded = await call(origin, '/companies/fresh-game-company');
    expect(loaded.body).toMatchObject({ kind: 'loaded', snapshot: { revision: 0, state: { week: 0, estate: { vineyards: [] }, winery: { lots: [] }, finance: { cashCents: 12_000_000 } } } });
    const planted = await call(origin, '/companies/fresh-game-company/commands', { commandId: 'plant-first-vineyard', expectedRevision: 0, command: { type: 'vineyard.establish', name: 'South slope', siteId: 'hillside', grapeId: 'pinot-noir', areaHa: 0.1 } });
    expect(planted.body.kind).toBe('committed');
    const restored = await call(origin, '/companies/fresh-game-company');
    expect(restored.body).toMatchObject({ snapshot: { revision: 1, state: { estate: { vineyards: [{ name: 'South slope' }] } } } });
  });

  it('recovers a lost sale response without selling or paying twice', async () => {
    const { origin, database } = await running();
    const { state, bottledId } = createBottledScenario();
    database.owners.set('sale-company', companyOwnerId({ kind: 'unassigned' }));
    database.names.set('sale-company', 'Sale test winery');
    database.saves.seed('sale-company', state);
    const envelope = { commandId: 'sell-once', expectedRevision: 0, command: { type: 'wine.sell', lotId: bottledId, buyerId: 'local-merchant', bottles: 20 } };
    database.saves.nextCommit = 'commit-then-unknown';
    expect((await call(origin, '/companies/sale-company/commands', envelope)).status).toBe(202);
    expect((await call(origin, '/companies/sale-company/resolve', { commandId: envelope.commandId })).body.kind).toBe('committed');
    expect((await call(origin, '/companies/sale-company/commands', envelope)).body.kind).toBe('already-committed');
    expect((await call(origin, '/companies/sale-company/commands', { ...envelope, commandId: 'stale-sale' })).status).toBe(409);
    const saved = database.saves.companies.get('sale-company')!;
    expect(saved.state.inventory.holdings.find(h => h.lotId === bottledId)?.quantity).toBe(80);
    expect(saved.state.commercial.sales).toHaveLength(1);
    expect(saved.state.finance.postings.filter(p => p.category === 'sale')).toHaveLength(1);
    const before = structuredClone(saved);
    expect((await call(origin, '/companies/sale-company/commands', { commandId: 'forged-price', expectedRevision: 1, command: { ...envelope.command, priceCents: 1 } })).status).toBe(400);
    expect(database.saves.companies.get('sale-company')).toEqual(before);
  });
});
