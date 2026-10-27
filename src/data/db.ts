import Dexie, { type EntityTable } from 'dexie';
import type {
  Collection,
  CookingSession,
  Ingredient,
  InventoryEvent,
  InventoryLot,
  MealPlanEntry,
  MediaAsset,
  PreferenceRow,
  Recipe,
  RecipeIngredient,
  RecipeStep,
  SchemaMigrationRow,
  ShoppingItem,
  ShoppingList,
} from './types';

export class PantryDB extends Dexie {
  ingredients!: EntityTable<Ingredient, 'id'>;
  inventoryLots!: EntityTable<InventoryLot, 'id'>;
  inventoryEvents!: EntityTable<InventoryEvent, 'id'>;
  recipes!: EntityTable<Recipe, 'id'>;
  recipeIngredients!: EntityTable<RecipeIngredient, 'id'>;
  recipeSteps!: EntityTable<RecipeStep, 'id'>;
  collections!: EntityTable<Collection, 'id'>;
  mealPlans!: EntityTable<MealPlanEntry, 'id'>;
  shoppingLists!: EntityTable<ShoppingList, 'id'>;
  shoppingItems!: EntityTable<ShoppingItem, 'id'>;
  cookingSessions!: EntityTable<CookingSession, 'id'>;
  preferences!: EntityTable<PreferenceRow, 'key'>;
  mediaAssets!: EntityTable<MediaAsset, 'id'>;
  schemaMigrations!: EntityTable<SchemaMigrationRow, 'version'>;

  constructor(name = 'pantrypal') {
    super(name);
    // Schema versions are append-only. To change a table, add `this.version(n+1)`
    // with the new store string (and an `.upgrade()` if data must be transformed),
    // then register the change in `migrations.ts`.
    this.version(1).stores({
      ingredients: 'id, name, category, isCustom',
      inventoryLots: 'id, ingredientId, zone, date, [ingredientId+zone]',
      inventoryEvents: 'id, lotId, ingredientId, at, &idempotencyKey',
      recipes: 'id, name, favorite, isStarter, cuisine',
      recipeIngredients: 'id, recipeId, ingredientId',
      recipeSteps: 'id, recipeId',
      collections: 'id, name',
      mealPlans: 'id, date, [date+slot], recipeId',
      shoppingLists: 'id',
      shoppingItems: 'id, listId, checked, category',
      cookingSessions: 'id, recipeId, status, startedAt',
      preferences: 'key',
      mediaAssets: 'id, kind',
      schemaMigrations: 'version',
    });
  }
}

export const db = new PantryDB();
