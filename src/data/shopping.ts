import { z } from 'zod';
import type { PantryDB } from './db';
import { db as defaultDb } from './db';
import { createInventory, InventoryError, type LotInput } from './inventory';
import type { ShoppingItem, ShoppingList } from './types';
import { lineCost, type NeedRow } from '@/domain/shopping';
import { isKnownUnit, tidy } from '@/domain/units';
import { newId } from '@/lib/ids';

const clean = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as T;

const listName = z
  .string()
  .trim()
  .min(1, 'Enter a name')
  .max(50, 'Keep the name under 50 characters');

export const itemSchema = z.object({
  name: z.string().trim().min(1, 'Enter an item').max(80),
  quantity: z.number().positive('Amount must be above 0').max(1_000_000).optional(),
  unit: z.string().refine(isKnownUnit, 'Choose a unit').optional(),
  category: z.string().trim().min(1).max(40).default('Other'),
  ingredientId: z.string().optional(),
  unitPrice: z.number().min(0).max(1_000_000).optional(),
  note: z.string().trim().max(200).optional(),
});
export type ItemInput = z.input<typeof itemSchema>;

export interface StockRow {
  itemId: string;
  ingredientId: string;
  quantity: number;
  unit: string;
  zone: LotInput['zone'];
  customZoneName?: string;
  dateLabel: LotInput['dateLabel'];
  date?: string;
}

export function createShopping(database: PantryDB = defaultDb) {
  const inventory = createInventory(database);

  async function createList(name: string, currency: string): Promise<ShoppingList> {
    const p = listName.safeParse(name);
    if (!p.success) throw new InventoryError(p.error.issues[0].message, 'invalid');
    const dupe = (await database.shoppingLists.toArray()).find(
      (l) => l.name.toLowerCase() === p.data.toLowerCase(),
    );
    if (dupe) throw new InventoryError(`"${dupe.name}" already exists`, 'duplicate');
    const now = Date.now();
    const l: ShoppingList = { id: newId(), name: p.data, currency, createdAt: now, updatedAt: now };
    await database.shoppingLists.add(l);
    return l;
  }

  async function updateList(
    id: string,
    patch: { name?: string; budget?: number | null; currency?: string },
  ) {
    const cur = await database.shoppingLists.get(id);
    if (!cur) throw new InventoryError('That list no longer exists', 'not_found');
    const next: Partial<ShoppingList> = { updatedAt: Date.now() };
    if (patch.name !== undefined) {
      const p = listName.safeParse(patch.name);
      if (!p.success) throw new InventoryError(p.error.issues[0].message, 'invalid');
      const dupe = (await database.shoppingLists.toArray()).find(
        (l) => l.id !== id && l.name.toLowerCase() === p.data.toLowerCase(),
      );
      if (dupe) throw new InventoryError(`"${dupe.name}" already exists`, 'duplicate');
      next.name = p.data;
    }
    if (patch.budget !== undefined) {
      if (patch.budget !== null && !(patch.budget >= 0 && patch.budget <= 100_000_000))
        throw new InventoryError('Enter a budget of 0 or more', 'invalid');
      next.budget = patch.budget ?? undefined;
    }
    if (patch.currency !== undefined) next.currency = patch.currency;
    await database.shoppingLists.put({ ...cur, ...next });
  }

  async function deleteList(id: string) {
    await database.transaction('rw', database.shoppingLists, database.shoppingItems, async () => {
      await database.shoppingItems.where('listId').equals(id).delete();
      await database.shoppingLists.delete(id);
    });
  }

  async function addItem(listId: string, input: ItemInput): Promise<ShoppingItem> {
    const p = itemSchema.safeParse(input);
    if (!p.success) throw new InventoryError(p.error.issues[0].message, 'invalid');
    if (!(await database.shoppingLists.get(listId)))
      throw new InventoryError('That list no longer exists', 'not_found');
    if ((p.data.quantity == null) !== (p.data.unit == null))
      throw new InventoryError('Give both an amount and a unit, or neither', 'invalid');
    const now = Date.now();
    const item: ShoppingItem = {
      ...clean(p.data),
      id: newId(),
      listId,
      checked: false,
      createdAt: now,
      updatedAt: now,
    } as ShoppingItem;
    await database.shoppingItems.add(item);
    return item;
  }

  async function updateItem(id: string, input: ItemInput) {
    const p = itemSchema.safeParse(input);
    if (!p.success) throw new InventoryError(p.error.issues[0].message, 'invalid');
    if ((p.data.quantity == null) !== (p.data.unit == null))
      throw new InventoryError('Give both an amount and a unit, or neither', 'invalid');
    const cur = await database.shoppingItems.get(id);
    if (!cur) throw new InventoryError('That item no longer exists', 'not_found');
    const { quantity, unit, unitPrice, note, ingredientId, ...rest } = cur;
    void quantity;
    void unit;
    void unitPrice;
    void note;
    void ingredientId;
    await database.shoppingItems.put({
      ...rest,
      ...clean(p.data),
      updatedAt: Date.now(),
    } as ShoppingItem);
  }

  /** Ticking an item only ticks it. Pantry stock is never changed here. */
  async function setChecked(id: string, checked: boolean) {
    const n = await database.shoppingItems.update(id, { checked, updatedAt: Date.now() });
    if (!n) throw new InventoryError('That item no longer exists', 'not_found');
  }

  async function removeItems(ids: string[]) {
    await database.shoppingItems.bulkDelete(ids);
  }

  /**
   * Adds the confirmed shortfalls. A row merges into an unchecked item for the same ingredient
   * and unit (so repeat generation never duplicates); otherwise it becomes a new item.
   */
  async function applyNeeds(
    listId: string,
    rows: Pick<NeedRow, 'ingredientId' | 'name' | 'category' | 'unit' | 'toBuy'>[],
  ) {
    return database.transaction('rw', database.shoppingLists, database.shoppingItems, async () => {
      if (!(await database.shoppingLists.get(listId)))
        throw new InventoryError('That list no longer exists', 'not_found');
      const existing = await database.shoppingItems.where('listId').equals(listId).toArray();
      let added = 0;
      let merged = 0;
      for (const r of rows) {
        if (!(r.toBuy > 0)) continue;
        const same = existing.find(
          (i) =>
            !i.checked && !i.stockedAt && i.ingredientId === r.ingredientId && i.unit === r.unit,
        );
        if (same) {
          const q = tidy((same.quantity ?? 0) + r.toBuy);
          await database.shoppingItems.update(same.id, { quantity: q, updatedAt: Date.now() });
          same.quantity = q;
          merged++;
        } else {
          const now = Date.now();
          const item: ShoppingItem = {
            id: newId(),
            listId,
            name: r.name,
            ingredientId: r.ingredientId,
            quantity: r.toBuy,
            unit: r.unit,
            category: r.category,
            checked: false,
            createdAt: now,
            updatedAt: now,
          };
          await database.shoppingItems.add(item);
          existing.push(item);
          added++;
        }
      }
      return { added, merged };
    });
  }

  /**
   * Moves purchased items into the pantry after the user confirmed amount, place and date.
   * All-or-nothing; an item that was already stocked cannot be stocked again.
   */
  async function stockPurchased(rows: StockRow[]) {
    return database.transaction(
      'rw',
      [
        database.shoppingItems,
        database.shoppingLists,
        database.inventoryLots,
        database.inventoryEvents,
        database.ingredients,
      ],
      async () => {
        for (const r of rows) {
          const item = await database.shoppingItems.get(r.itemId);
          if (!item) throw new InventoryError('An item is no longer on the list', 'not_found');
          if (item.stockedAt)
            throw new InventoryError(`${item.name} was already added to your pantry`, 'duplicate');
          const list = await database.shoppingLists.get(item.listId);
          const cost =
            lineCost({ unitPrice: item.unitPrice, quantity: r.quantity, unit: r.unit }) ??
            undefined;
          await inventory.addLot(
            clean({
              ingredientId: r.ingredientId,
              quantity: r.quantity,
              unit: r.unit,
              zone: r.zone,
              customZoneName: r.customZoneName,
              dateLabel: r.dateLabel,
              date: r.date,
              purchasedOn: today(),
              cost,
              currency: cost != null ? list?.currency : undefined,
            }) as LotInput,
            { type: 'purchase', idempotencyKey: `purchase:${item.id}` },
          );
          await database.shoppingItems.update(item.id, { stockedAt: Date.now(), checked: true });
        }
        return rows.length;
      },
    );
  }

  return {
    createList,
    updateList,
    deleteList,
    addItem,
    updateItem,
    setChecked,
    removeItems,
    applyNeeds,
    stockPurchased,
  };
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const shopping = createShopping();
