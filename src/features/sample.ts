import type { ArtKey } from '@/design/illustrations';

/**
 * Illustrative sample content, shown only when the user keeps "Sample content" on.
 * It is presentational: nothing here is stored in the database or counted as real data.
 */
export interface SampleRecipe {
  id: string;
  name: string;
  minutes: number;
  difficulty: 'Easy' | 'Medium';
  have: number;
  total: number;
  art: ArtKey;
}

export const SAMPLE_RECIPES: SampleRecipe[] = [
  {
    id: 'creamy-tomato-pasta',
    name: 'Creamy Tomato Pasta',
    minutes: 25,
    difficulty: 'Easy',
    have: 5,
    total: 6,
    art: 'pasta',
  },
  {
    id: 'garden-frittata',
    name: 'Garden Frittata',
    minutes: 20,
    difficulty: 'Easy',
    have: 5,
    total: 5,
    art: 'frittata',
  },
  {
    id: 'chickpea-curry',
    name: 'Chickpea Curry',
    minutes: 30,
    difficulty: 'Medium',
    have: 4,
    total: 6,
    art: 'curry',
  },
  {
    id: 'banana-pancakes',
    name: 'Banana Pancakes',
    minutes: 15,
    difficulty: 'Easy',
    have: 6,
    total: 7,
    art: 'pancakes',
  },
  {
    id: 'veggie-bowl',
    name: 'Veggie Grain Bowl',
    minutes: 25,
    difficulty: 'Easy',
    have: 4,
    total: 6,
    art: 'bowl',
  },
  {
    id: 'garden-salad',
    name: 'Garden Salad',
    minutes: 10,
    difficulty: 'Easy',
    have: 4,
    total: 4,
    art: 'salad',
  },
  {
    id: 'tomato-soup',
    name: 'Roasted Tomato Soup',
    minutes: 35,
    difficulty: 'Easy',
    have: 3,
    total: 5,
    art: 'soup',
  },
];

export const SAMPLE_EXPIRING: { name: string; days: number; art: ArtKey }[] = [
  { name: 'Tomatoes', days: 2, art: 'tomato' },
  { name: 'Milk', days: 3, art: 'milk' },
  { name: 'Spinach', days: 4, art: 'spinach' },
  { name: 'Chicken breast', days: 5, art: 'chicken' },
  { name: 'Yogurt', days: 6, art: 'yogurt' },
];

/** Monday-first order, matched to SAMPLE_RECIPES by index modulo. */
export const SAMPLE_WEEK: { label: string; art: ArtKey }[] = [
  { label: 'Pasta', art: 'pasta' },
  { label: 'Frittata', art: 'frittata' },
  { label: 'Bowl', art: 'bowl' },
  { label: 'Curry', art: 'curry' },
  { label: 'Salad', art: 'salad' },
  { label: 'Soup', art: 'soup' },
  { label: 'Pancakes', art: 'pancakes' },
];

export const SAMPLE_STATS = { ingredients: 24, expiring: 5, lowStock: 8, recipes: 8 };

export const SAMPLE_BANNER =
  'Showing illustrative sample content. Turn it off in Settings to see your real, empty kitchen.';
