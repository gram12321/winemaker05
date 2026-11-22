import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { CompanyStore } from '../../src/authority/contracts';
import { readCompanyState } from '../../src/game/core/CompanyState';
import { createApiServer } from '../../src/server/api/server';
import type { PlayerProfileRecord, PlayerProfileStore } from '../../src/server/playerProfiles';
import { InMemorySave } from '../authority/inMemorySave';

/** Isolated test storage. Gameplay and HTTP behavior use the production authority. */
export class TestCompanyDatabase {
  readonly saves = new InMemorySave();
  readonly owners = new Map<string, string>();
  readonly names = new Map<string, string>();
  readonly players = new Map<string, PlayerProfileRecord>();
  readonly profiles: PlayerProfileStore = {
    list: async () => [...this.players.values()],
    get: async id => this.players.get(id.toLowerCase()) ?? null,
    create: async ({ id, name }) => {
      const existing = this.players.get(id);
      if (existing) return existing.name === name ? existing : null;
      const profile = { id, name, createdAt: new Date().toISOString() };
      this.players.set(id, profile);
      return profile;
    },
    rename: async ({ id, name }) => {
      const existing = this.players.get(id);
      if (!existing) return null;
      const profile = { ...existing, name };
      this.players.set(id, profile);
      return profile;
    },
  };

  store(ownerId: string): CompanyStore {
    const owns = (id: string) => this.owners.get(id) === ownerId;
    return {
      listCompanies: async () => ({ kind: 'listed', companies: [...this.owners].filter(([, owner]) => owner === ownerId).map(([id]) => ({ id, name: this.names.get(id)!, date: this.saves.companies.get(id)!.state.calendar.date })) }),
      createCompany: async ({ companyId, name, state }) => {
        if (this.owners.has(companyId)) return { kind: 'not-created' };
        if (readCompanyState(state).kind !== 'valid') return { kind: 'invalid', details: 'Invalid test company.' };
        this.owners.set(companyId, ownerId); this.names.set(companyId, name); this.saves.seed(companyId, state);
        return { kind: 'created' };
      },
      load: async id => owns(id) ? this.saves.load(id) : { kind: 'missing' },
      getReceipt: async (id, command) => owns(id) ? this.saves.getReceipt(id, command) : { kind: 'unavailable', details: 'Unavailable company.' },
      commit: async input => owns(input.companyId) ? this.saves.commit(input) : { kind: 'failed', details: 'Unavailable company.' },
      resolveAttempt: async input => owns(input.companyId) ? this.saves.resolveAttempt(input) : { kind: 'unavailable', details: 'Unavailable company.' },
    };
  }
}

export async function startTestAuthority(port = 0) {
  const database = new TestCompanyDatabase();
  const server = createApiServer({
    storeForOwner: owner => database.store(owner), playerProfiles: database.profiles,
    newCompany: { rules: { weeksPerSeason: 12, seasonsPerYear: 4 }, initialDate: { year: 1, season: 1, week: 1 } },
  });
  server.listen(port, '127.0.0.1');
  await once(server, 'listening');
  return {
    database, origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    },
  };
}
