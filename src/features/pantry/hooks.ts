import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import type { Ingredient, InventoryLot, StorageZone } from '@/data/types';
import { groupByIngredient, type IngredientSummary } from '@/domain/lots';
import { toISODate } from '@/lib/dates';
import { usePrefs } from '@/app/PrefsProvider';

/** Today's local date, refreshed when the day rolls over while the app is open. */
export function useToday(): string {
  const [today, setToday] = useState(() => toISODate(new Date()));
  useEffect(() => {
    const t = setInterval(() => {
      const now = toISODate(new Date());
      setToday((cur) => (cur === now ? cur : now));
    }, 60_000);
    return () => clearInterval(t);
  }, []);
  return today;
}

export interface PantryData {
  ingredients: Ingredient[];
  lots: InventoryLot[];
  today: string;
  leadDays: number;
  all: IngredientSummary[];
  byZone: (zone: StorageZone) => IngredientSummary[];
}

/** Live inventory snapshot. `undefined` until the first read finishes. */
export function usePantryData(): PantryData | undefined {
  const { prefs } = usePrefs();
  const today = useToday();
  const raw = useLiveQuery(async () => {
    const [ingredients, lots] = await Promise.all([
      db.ingredients.toArray(),
      db.inventoryLots.toArray(),
    ]);
    return { ingredients, lots };
  }, []);
  return useMemo(() => {
    if (!raw) return undefined;
    const leadDays = prefs.expiryLeadDays;
    return {
      ...raw,
      today,
      leadDays,
      all: groupByIngredient(raw.ingredients, raw.lots, today, leadDays),
      byZone: (zone: StorageZone) =>
        groupByIngredient(
          raw.ingredients,
          raw.lots.filter((l) => l.zone === zone),
          today,
          leadDays,
        ),
    };
  }, [raw, today, prefs.expiryLeadDays]);
}
