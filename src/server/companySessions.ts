import { randomUUID } from 'node:crypto';
import { CompanySession, type CompanySavePort } from '../authority';

interface SessionEntry {
  readonly session: CompanySession;
  tail: Promise<void>;
}

/** Serialize work for one scope/company and retain only sessions needed for recovery. */
export class CompanySessions {
  private readonly entries = new Map<string, SessionEntry>();

  run<T>(ownerId: string, companyId: string, store: CompanySavePort, action: (session: CompanySession) => Promise<T>): Promise<T> {
    const key = JSON.stringify([ownerId, companyId]);
    let entry = this.entries.get(key);
    if (!entry) {
      entry = { session: new CompanySession(store, randomUUID), tail: Promise.resolve() };
      this.entries.set(key, entry);
    }
    const active = entry;
    const result = active.tail.then(() => action(active.session));
    const tail = result.then(() => undefined, () => undefined);
    active.tail = tail;
    void tail.then(() => {
      if (active.tail === tail && active.session.canDispose() && this.entries.get(key) === active) this.entries.delete(key);
    });
    return result;
  }
}
