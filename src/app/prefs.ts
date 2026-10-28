import { z } from 'zod';

export const ACCENTS = ['terracotta', 'sage', 'saffron', 'plum'] as const;
export const BACKGROUNDS = ['kitchen', 'solid', 'pattern', 'botanical', 'custom'] as const;
export const MOTION_LEVELS = ['low', 'balanced', 'cinematic'] as const;
export const THEMES = ['light', 'dark', 'system'] as const;
export const CURRENCIES = ['MKD', 'EUR', 'USD', 'GBP', 'CHF', 'RSD'] as const;
export const DIETS = ['vegetarian', 'vegan', 'pescatarian', 'gluten-free', 'dairy-free'] as const;
export const ALLERGENS = [
  'gluten',
  'dairy',
  'eggs',
  'peanuts',
  'tree nuts',
  'soy',
  'fish',
  'shellfish',
  'sesame',
] as const;

export const prefsSchema = z.object({
  onboarded: z.boolean().default(false),
  name: z.string().trim().max(40).default(''),
  theme: z.enum(THEMES).default('light'),
  accent: z.enum(ACCENTS).default('terracotta'),
  background: z.enum(BACKGROUNDS).default('kitchen'),
  /** Shows clearly-labelled illustrative sample content instead of empty states. */
  sampleContent: z.boolean().default(true),
  customBackgroundId: z.string().optional(),
  bgDim: z.number().min(0).max(80).default(35),
  bgBlur: z.number().min(0).max(20).default(4),
  bgContrast: z.number().min(70).max(130).default(100),
  motion: z.enum(MOTION_LEVELS).default('balanced'),
  units: z.enum(['metric', 'imperial']).default('metric'),
  currency: z.enum(CURRENCIES).default('MKD'),
  weekStart: z.enum(['monday', 'sunday']).default('monday'),
  household: z.number().int().min(1).max(20).optional(),
  diets: z.array(z.enum(DIETS)).default([]),
  allergens: z.array(z.enum(ALLERGENS)).default([]),
});

export type Prefs = z.infer<typeof prefsSchema>;
export const DEFAULT_PREFS: Prefs = prefsSchema.parse({});

const KEY = 'pantrypal.prefs.v1';

/** Reads stored prefs; any corrupt or unknown value falls back to defaults field-by-field. */
export function loadPrefs(storage: Pick<Storage, 'getItem'> | null = safeStorage()): Prefs {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    let parsed: unknown = JSON.parse(raw);
    // Prefs saved before sample content existed: adopt the new default look once.
    if (parsed && typeof parsed === 'object' && !('sampleContent' in parsed)) {
      parsed = { ...parsed, sampleContent: true, background: 'kitchen' };
    }
    const whole = prefsSchema.safeParse(parsed);
    if (whole.success) return whole.data;
    if (parsed && typeof parsed === 'object') {
      const out: Record<string, unknown> = { ...DEFAULT_PREFS };
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        const trial = prefsSchema.safeParse({ ...out, [k]: v });
        if (trial.success) out[k] = v;
      }
      return prefsSchema.parse(out);
    }
  } catch {
    /* storage blocked or JSON corrupt */
  }
  return DEFAULT_PREFS;
}

export function savePrefs(
  prefs: Prefs,
  storage: Pick<Storage, 'setItem'> | null = safeStorage(),
): void {
  try {
    storage?.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* quota or blocked: preferences simply don't persist */
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
