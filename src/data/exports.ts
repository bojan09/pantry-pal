import type { PantryDB } from './db';
import { db as defaultDb } from './db';
import { dateLabelText } from '@/domain/lots';
import { lineCost } from '@/domain/shopping';
import { formatQuantity } from '@/domain/units';
import { toCsv } from '@/lib/csv';

const day = (ms?: number) => (ms ? new Date(ms).toISOString().slice(0, 10) : '');

export function createExports(database: PantryDB = defaultDb) {
  async function inventoryCsv() {
    const [lots, ings] = await Promise.all([
      database.inventoryLots.toArray(),
      database.ingredients.toArray(),
    ]);
    const by = new Map(ings.map((i) => [i.id, i]));
    return toCsv(
      [
        'Ingredient',
        'Category',
        'Quantity',
        'Unit',
        'Stored in',
        'Date type',
        'Date',
        'Purchased',
        'Opened',
        'Cost',
        'Currency',
        'Note',
      ],
      lots
        .sort((a, b) =>
          (by.get(a.ingredientId)?.name ?? '').localeCompare(by.get(b.ingredientId)?.name ?? ''),
        )
        .map((l) => [
          by.get(l.ingredientId)?.name,
          by.get(l.ingredientId)?.category,
          l.quantity,
          l.unit,
          l.zone === 'custom' ? (l.customZoneName ?? 'Other place') : l.zone,
          l.dateLabel === 'unknown' ? '' : dateLabelText(l.dateLabel),
          l.date,
          l.purchasedOn,
          l.openedOn,
          l.cost,
          l.currency,
          l.note,
        ]),
    );
  }

  async function shoppingCsv(listId: string) {
    const [list, items] = await Promise.all([
      database.shoppingLists.get(listId),
      database.shoppingItems.where('listId').equals(listId).toArray(),
    ]);
    return {
      name: list?.name ?? 'shopping-list',
      csv: toCsv(
        [
          'Item',
          'Amount',
          'Unit',
          'Category',
          'Ticked',
          'In pantry',
          'Price per kg/L/piece',
          'Estimated cost',
          'Currency',
          'Note',
        ],
        items.map((i) => [
          i.name,
          i.quantity,
          i.unit,
          i.category,
          i.checked,
          !!i.stockedAt,
          i.unitPrice,
          lineCost(i),
          list?.currency,
          i.note,
        ]),
      ),
    };
  }

  async function historyCsv() {
    const [sessions, recipes, ings] = await Promise.all([
      database.cookingSessions.filter((s) => s.status === 'completed').toArray(),
      database.recipes.toArray(),
      database.ingredients.toArray(),
    ]);
    const rn = new Map(recipes.map((r) => [r.id, r.name]));
    const inn = new Map(ings.map((i) => [i.id, i.name]));
    return toCsv(
      ['Date', 'Recipe', 'Servings', 'Rating', 'Notes', 'Undone', 'Pantry items used'],
      sessions
        .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))
        .map((s) => [
          day(s.finishedAt ?? s.startedAt),
          rn.get(s.recipeId) ?? s.recipeName,
          s.servings,
          s.rating,
          s.notes,
          !!s.undoneAt,
          (s.deductions ?? [])
            .map(
              (d) =>
                `${inn.get(d.ingredientId) ?? 'Ingredient'} (${formatQuantity(d.quantity, d.unit)})`,
            )
            .join('; '),
        ]),
    );
  }

  async function recipesCsv() {
    const [recipes, lines, ings] = await Promise.all([
      database.recipes.toArray(),
      database.recipeIngredients.toArray(),
      database.ingredients.toArray(),
    ]);
    const inn = new Map(ings.map((i) => [i.id, i.name]));
    return toCsv(
      [
        'Recipe',
        'Source',
        'Category',
        'Cuisine',
        'Difficulty',
        'Servings',
        'Prep (min)',
        'Cook (min)',
        'Favourite',
        'Tags',
        'Ingredients',
      ],
      recipes
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((r) => [
          r.name,
          r.isStarter ? 'Starter cookbook' : 'Mine',
          r.category,
          r.cuisine,
          r.difficulty,
          r.servings,
          r.prepMinutes,
          r.cookMinutes,
          r.favorite,
          r.tags.join('; '),
          lines
            .filter((l) => l.recipeId === r.id)
            .sort((a, b) => a.position - b.position)
            .map((l) =>
              `${formatQuantity(l.quantity, l.unit)} ${inn.get(l.ingredientId) ?? ''}`.trim(),
            )
            .join('; '),
        ]),
    );
  }

  return { inventoryCsv, shoppingCsv, historyCsv, recipesCsv };
}
export const exportsApi = createExports();
