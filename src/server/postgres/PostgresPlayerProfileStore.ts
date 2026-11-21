import type { Pool } from 'pg';
import type { PlayerProfileRecord, PlayerProfileStore } from '../api/server';

interface PlayerRow { player_id: string; player_name: string; created_at: Date | string }

function map(row: PlayerRow): PlayerProfileRecord {
  return { id: row.player_id, name: row.player_name, createdAt: new Date(row.created_at).toISOString() };
}

/** Server-only persistence for 04-style selectable local player profiles. */
export class PostgresPlayerProfileStore implements PlayerProfileStore {
  constructor(private readonly pool: Pool) {}

  async list(): Promise<readonly PlayerProfileRecord[]> {
    const result = await this.pool.query<PlayerRow>(
      'SELECT player_id, player_name, created_at FROM winemaker05_private.player_profiles ORDER BY created_at, player_id',
    );
    return result.rows.map(map);
  }

  async get(id: string): Promise<PlayerProfileRecord | null> {
    const result = await this.pool.query<PlayerRow>(
      'SELECT player_id, player_name, created_at FROM winemaker05_private.player_profiles WHERE player_id = $1', [id],
    );
    return result.rows[0] ? map(result.rows[0]) : null;
  }

  async create(input: { id: string; name: string }): Promise<PlayerProfileRecord> {
    const result = await this.pool.query<PlayerRow>(
      `INSERT INTO winemaker05_private.player_profiles (player_id, player_name)
       VALUES ($1, $2) RETURNING player_id, player_name, created_at`,
      [input.id, input.name],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Player profile creation returned no row.');
    return map(row);
  }

  async rename(input: { id: string; name: string }): Promise<PlayerProfileRecord | null> {
    const result = await this.pool.query<PlayerRow>(
      `UPDATE winemaker05_private.player_profiles SET player_name = $2
       WHERE player_id = $1 RETURNING player_id, player_name, created_at`,
      [input.id, input.name],
    );
    return result.rows[0] ? map(result.rows[0]) : null;
  }
}
