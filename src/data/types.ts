export type ID = string;
export type StorageZone = 'pantry' | 'fridge' | 'freezer' | 'custom';
export type DateLabel = 'use_by' | 'best_before' | 'unknown';
export type UnitDimension = 'mass' | 'volume' | 'count';
export type InventoryEventType = 'add' | 'use' | 'transfer' | 'discard' | 'correct' | 'purchase';
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack' | string;

interface Stamped {
  id: ID;
  createdAt: number;
  updatedAt: number;
}

export interface Ingredient extends Stamped {
  name: string;
  aliases: string[];
  category: string;
  defaultUnit: string;
  /** grams per millilitre, only when known for this ingredient */
  densityGPerMl?: number;
  allergens: string[];
  isCustom: boolean;
  icon?: string;
}

export interface InventoryLot extends Stamped {
  ingredientId: ID;
  /** quantity in the lot's `unit` */
  quantity: number;
  unit: string;
  zone: StorageZone;
  customZoneName?: string;
  purchasedOn?: string; // ISO date yyyy-mm-dd
  openedOn?: string;
  dateLabel: DateLabel;
  date?: string;
  packageSize?: number;
  lowStockThreshold?: number;
  cost?: number;
  currency?: string;
  note?: string;
}

export interface InventoryEvent {
  id: ID;
  lotId: ID;
  ingredientId: ID;
  type: InventoryEventType;
  delta: number;
  unit: string;
  at: number;
  /** guards against applying the same cooking session / purchase twice */
  idempotencyKey?: string;
  note?: string;
}

export interface Recipe extends Stamped {
  name: string;
  summary: string;
  cuisine?: string;
  category?: string;
  tags: string[];
  prepMinutes: number;
  cookMinutes: number;
  difficulty: 'easy' | 'medium' | 'hard';
  servings: number;
  favorite: boolean;
  isStarter: boolean;
  imageId?: ID;
  art?: string;
  notes?: string;
}

export interface RecipeIngredient {
  id: ID;
  recipeId: ID;
  ingredientId: ID;
  quantity: number;
  unit: string;
  optional?: boolean;
  position: number;
}

export interface RecipeStep {
  id: ID;
  recipeId: ID;
  position: number;
  text: string;
  timerSeconds?: number;
}

export interface Collection extends Stamped {
  name: string;
  recipeIds: ID[];
}

export interface MealPlanEntry extends Stamped {
  date: string; // yyyy-mm-dd
  slot: MealSlot;
  recipeId?: ID;
  label?: string;
  servings: number;
  position: number;
}

export interface ShoppingList extends Stamped {
  name: string;
  currency: string;
}

export interface ShoppingItem extends Stamped {
  listId: ID;
  name: string;
  ingredientId?: ID;
  quantity?: number;
  unit?: string;
  category: string;
  checked: boolean;
  unitPrice?: number;
}

export interface CookingSession {
  id: ID;
  recipeId: ID;
  startedAt: number;
  finishedAt?: number;
  servings: number;
  status: 'active' | 'completed' | 'cancelled';
  rating?: number;
  notes?: string;
  timers?: { id: ID; label: string; endsAt: number }[];
}

export interface PreferenceRow {
  key: string;
  value: unknown;
}

export interface MediaAsset {
  id: ID;
  kind: 'background' | 'recipe';
  mime: string;
  width: number;
  height: number;
  blob: Blob;
  createdAt: number;
}

export interface SchemaMigrationRow {
  version: number;
  name: string;
  appliedAt: number;
}
