import type { PantryDB } from './db';

export interface Migration {
  version: number;
  name: string;
}

/** Keep in sync with the `this.version(n)` calls in db.ts. */
export const MIGRATIONS: Migration[] = [{ version: 1, name: 'initial schema' }];

export const CURRENT_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

/**
 * Dexie performs the structural upgrade on open. This records each applied
 * version once so the app (and backups) can tell what schema produced the data.
 */
export async function recordMigrations(database: PantryDB): Promise<number[]> {
  await database.open();
  const applied = new Set((await database.schemaMigrations.toArray()).map((m) => m.version));
  const fresh = MIGRATIONS.filter((m) => !applied.has(m.version));
  if (fresh.length) {
    await database.schemaMigrations.bulkPut(fresh.map((m) => ({ ...m, appliedAt: Date.now() })));
  }
  return fresh.map((m) => m.version);
}
