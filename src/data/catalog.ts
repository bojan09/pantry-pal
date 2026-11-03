import type { Ingredient } from './types';

export const CATEGORIES = [
  'Vegetables',
  'Fruit',
  'Dairy & Eggs',
  'Meat & Fish',
  'Grains & Pasta',
  'Bakery',
  'Canned & Jarred',
  'Baking',
  'Spices & Herbs',
  'Oils & Sauces',
  'Snacks & Sweets',
  'Drinks',
  'Frozen',
  'Other',
] as const;
export type Category = (typeof CATEGORIES)[number];

/** [name, category, default unit, density g/ml (only when well known), allergens, aliases] */
type Row = [string, Category, string, number?, string[]?, string[]?];

const ROWS: Row[] = [
  // Vegetables
  ['Tomatoes', 'Vegetables', 'pcs', undefined, undefined, ['tomato']],
  ['Onions', 'Vegetables', 'pcs', undefined, undefined, ['onion']],
  ['Garlic', 'Vegetables', 'pcs', undefined, undefined, ['garlic cloves', 'garlic bulb']],
  ['Potatoes', 'Vegetables', 'kg', undefined, undefined, ['potato']],
  ['Carrots', 'Vegetables', 'kg', undefined, undefined, ['carrot']],
  ['Spinach', 'Vegetables', 'g'],
  [
    'Bell peppers',
    'Vegetables',
    'pcs',
    undefined,
    undefined,
    ['pepper', 'bell pepper', 'capsicum'],
  ],
  ['Cucumbers', 'Vegetables', 'pcs', undefined, undefined, ['cucumber']],
  ['Zucchini', 'Vegetables', 'pcs', undefined, undefined, ['courgette']],
  ['Broccoli', 'Vegetables', 'g'],
  ['Lettuce', 'Vegetables', 'pcs'],
  ['Mushrooms', 'Vegetables', 'g'],
  ['Eggplant', 'Vegetables', 'pcs', undefined, undefined, ['aubergine']],
  ['Cabbage', 'Vegetables', 'kg'],
  // Fruit
  ['Bananas', 'Fruit', 'pcs', undefined, undefined, ['banana']],
  ['Apples', 'Fruit', 'pcs', undefined, undefined, ['apple']],
  ['Lemons', 'Fruit', 'pcs', undefined, undefined, ['lemon']],
  ['Oranges', 'Fruit', 'pcs', undefined, undefined, ['orange']],
  ['Strawberries', 'Fruit', 'g'],
  ['Blueberries', 'Fruit', 'g'],
  ['Grapes', 'Fruit', 'g'],
  // Dairy & Eggs
  ['Milk', 'Dairy & Eggs', 'l', 1.03, ['dairy']],
  ['Eggs', 'Dairy & Eggs', 'pcs', undefined, ['eggs']],
  ['Butter', 'Dairy & Eggs', 'g', 0.96, ['dairy']],
  ['Yogurt', 'Dairy & Eggs', 'g', 1.04, ['dairy'], ['yoghurt']],
  ['Cheese', 'Dairy & Eggs', 'g', undefined, ['dairy']],
  ['Parmesan', 'Dairy & Eggs', 'g', undefined, ['dairy'], ['parmigiano']],
  ['Feta', 'Dairy & Eggs', 'g', undefined, ['dairy']],
  ['Cream', 'Dairy & Eggs', 'ml', 1.01, ['dairy'], ['heavy cream', 'double cream']],
  ['Sour cream', 'Dairy & Eggs', 'g', undefined, ['dairy']],
  // Meat & Fish
  ['Chicken breast', 'Meat & Fish', 'g'],
  ['Minced beef', 'Meat & Fish', 'g', undefined, undefined, ['ground beef']],
  ['Pork', 'Meat & Fish', 'g'],
  ['Bacon', 'Meat & Fish', 'g'],
  ['Salmon', 'Meat & Fish', 'g', undefined, ['fish']],
  ['Tuna', 'Meat & Fish', 'g', undefined, ['fish']],
  ['Sausages', 'Meat & Fish', 'pcs'],
  // Grains & Pasta
  ['Pasta', 'Grains & Pasta', 'g', undefined, ['gluten'], ['spaghetti', 'penne']],
  ['Rice', 'Grains & Pasta', 'g', 0.85],
  ['Oats', 'Grains & Pasta', 'g', 0.4, ['gluten'], ['rolled oats']],
  ['Couscous', 'Grains & Pasta', 'g', undefined, ['gluten']],
  ['Quinoa', 'Grains & Pasta', 'g'],
  ['Lentils', 'Grains & Pasta', 'g', 0.85],
  ['Chickpeas (dried)', 'Grains & Pasta', 'g', 0.8, undefined, ['garbanzo']],
  ['Beans (dried)', 'Grains & Pasta', 'g', 0.8],
  ['Cornmeal', 'Grains & Pasta', 'g'],
  // Bakery
  ['Bread', 'Bakery', 'pcs', undefined, ['gluten']],
  ['Tortillas', 'Bakery', 'pack', undefined, ['gluten']],
  ['Breadcrumbs', 'Bakery', 'g', undefined, ['gluten']],
  // Canned & Jarred
  [
    'Canned tomatoes',
    'Canned & Jarred',
    'can',
    undefined,
    undefined,
    ['tinned tomatoes', 'chopped tomatoes'],
  ],
  ['Canned chickpeas', 'Canned & Jarred', 'can'],
  ['Canned beans', 'Canned & Jarred', 'can'],
  ['Canned tuna', 'Canned & Jarred', 'can', undefined, ['fish']],
  ['Coconut milk', 'Canned & Jarred', 'can', 0.97],
  ['Tomato paste', 'Canned & Jarred', 'g', 1.1, undefined, ['tomato puree']],
  ['Olives', 'Canned & Jarred', 'jar-m'],
  ['Pickles', 'Canned & Jarred', 'jar-m'],
  ['Jam', 'Canned & Jarred', 'jar-m', 1.3],
  // Baking
  ['Flour', 'Baking', 'g', 0.53, ['gluten'], ['all-purpose flour', 'plain flour']],
  ['Sugar', 'Baking', 'g', 0.85],
  ['Brown sugar', 'Baking', 'g', 0.93],
  ['Baking powder', 'Baking', 'g'],
  ['Baking soda', 'Baking', 'g', undefined, undefined, ['bicarbonate of soda']],
  ['Yeast', 'Baking', 'g'],
  ['Cocoa powder', 'Baking', 'g', 0.5],
  ['Vanilla extract', 'Baking', 'ml'],
  ['Honey', 'Baking', 'g', 1.42],
  // Spices & Herbs
  ['Salt', 'Spices & Herbs', 'g', 1.2],
  ['Black pepper', 'Spices & Herbs', 'g'],
  ['Paprika', 'Spices & Herbs', 'g'],
  ['Cumin', 'Spices & Herbs', 'g'],
  ['Cinnamon', 'Spices & Herbs', 'g'],
  ['Oregano', 'Spices & Herbs', 'g'],
  ['Basil', 'Spices & Herbs', 'g'],
  ['Parsley', 'Spices & Herbs', 'g'],
  ['Thyme', 'Spices & Herbs', 'g'],
  ['Chili flakes', 'Spices & Herbs', 'g'],
  // Oils & Sauces
  ['Olive oil', 'Oils & Sauces', 'ml', 0.91],
  ['Sunflower oil', 'Oils & Sauces', 'ml', 0.92, undefined, ['vegetable oil']],
  ['Vinegar', 'Oils & Sauces', 'ml', 1.01],
  ['Soy sauce', 'Oils & Sauces', 'ml', 1.15, ['soy', 'gluten']],
  ['Ketchup', 'Oils & Sauces', 'g', 1.15],
  ['Mustard', 'Oils & Sauces', 'g'],
  ['Mayonnaise', 'Oils & Sauces', 'g', 0.91, ['eggs']],
  ['Ajvar', 'Oils & Sauces', 'jar-m'],
  // Snacks & Sweets
  ['Chocolate', 'Snacks & Sweets', 'g'],
  ['Biscuits', 'Snacks & Sweets', 'pack', undefined, ['gluten']],
  ['Almonds', 'Snacks & Sweets', 'g', undefined, ['tree nuts']],
  ['Walnuts', 'Snacks & Sweets', 'g', undefined, ['tree nuts']],
  ['Peanut butter', 'Snacks & Sweets', 'g', 1.09, ['peanuts']],
  // Drinks
  ['Coffee', 'Drinks', 'g'],
  ['Tea', 'Drinks', 'pack'],
  ['Orange juice', 'Drinks', 'l', 1.04],
  ['Water', 'Drinks', 'l', 1],
  // Frozen
  ['Frozen peas', 'Frozen', 'g'],
  ['Frozen berries', 'Frozen', 'g'],
  ['Frozen spinach', 'Frozen', 'g'],
  ['Ice cream', 'Frozen', 'ml', undefined, ['dairy']],
];

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** v2: jar-sized units for ajvar, pickles, olives and jam. */
export const CATALOG_VERSION = 2;

/** Stable ids ("ing-tomatoes") make seeding idempotent and let backups reference catalog items. */
export const CATALOG: Ingredient[] = ROWS.map(
  ([name, category, defaultUnit, density, allergens, aliases]) => ({
    id: `ing-${slug(name)}`,
    name,
    aliases: aliases ?? [],
    category,
    defaultUnit,
    densityGPerMl: density,
    allergens: allergens ?? [],
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
  }),
);

export type SpriteKind =
  'produce' | 'carton' | 'tray' | 'jar' | 'spice' | 'can' | 'bottle' | 'box' | 'loaf' | 'bag';

export function spriteKindFor(
  i: Pick<Ingredient, 'category' | 'defaultUnit' | 'name'>,
): SpriteKind {
  if (i.defaultUnit.startsWith('jar')) return 'jar';
  switch (i.category) {
    case 'Vegetables':
    case 'Fruit':
      return 'produce';
    case 'Dairy & Eggs':
      return 'carton';
    case 'Meat & Fish':
      return 'tray';
    case 'Grains & Pasta':
      return 'bag';
    case 'Bakery':
      return 'loaf';
    case 'Canned & Jarred':
      return i.defaultUnit === 'can' ? 'can' : 'jar';
    case 'Baking':
      return 'bag';
    case 'Spices & Herbs':
      return 'spice';
    case 'Oils & Sauces':
      return 'bottle';
    case 'Frozen':
      return 'box';
    case 'Drinks':
      return 'bottle';
    default:
      return 'jar';
  }
}
