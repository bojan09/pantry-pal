import { describe, expect, it } from 'vitest';
import { PantryDB } from './db';
import { CURRENT_SCHEMA_VERSION, recordMigrations } from './migrations';

describe('PantryDB', () => {
  it('opens at the current schema version and records migrations once', async () => {
    const database = new PantryDB('test-' + Math.random());
    const first = await recordMigrations(database);
    expect(first).toEqual([1]);
    expect(await recordMigrations(database)).toEqual([]);
    expect(database.verno).toBe(CURRENT_SCHEMA_VERSION);
    expect(await database.schemaMigrations.count()).toBe(1);
  });

  it('rejects a duplicate idempotency key on inventory events', async () => {
    const database = new PantryDB('test-' + Math.random());
    const base = {
      lotId: 'l',
      ingredientId: 'i',
      type: 'use' as const,
      delta: -1,
      unit: 'g',
      at: 1,
    };
    await database.inventoryEvents.add({ ...base, id: 'a', idempotencyKey: 'cook-1' });
    await expect(
      database.inventoryEvents.add({ ...base, id: 'b', idempotencyKey: 'cook-1' }),
    ).rejects.toThrow();
  });
});
