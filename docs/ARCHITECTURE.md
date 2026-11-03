# Architecture

```
src/
  app/        shell (sidebar, top bar, bottom nav), router, prefs provider, background layer, PWA hooks
  design/     tokens live in index.css; ui.tsx primitives; illustrations/ (original SVG)
  features/   one folder/file per product area (Phase 1: pages are honest empty states)
  data/       Dexie schema (db.ts), entity types, migration registry
  domain/     pure TypeScript business logic (units, lots, matching…) — arrives in Phase 2+
  lib/        dates, ids, image downscale
```

## Decisions

- **Local only.** IndexedDB via Dexie for structured data; `localStorage` (`pantrypal.prefs.v1`) only for small UI prefs so they apply before first paint. Prefs are validated with zod and recover field-by-field from corrupt storage.
- **Schema.** Version 1 declares all planned tables (ingredients, inventoryLots, inventoryEvents, recipes, recipeIngredients, recipeSteps, collections, mealPlans, shoppingLists, shoppingItems, cookingSessions, preferences, mediaAssets, schemaMigrations). `inventoryEvents.idempotencyKey` is a unique index so a cooking session or purchase can't be applied twice. To change schema: add `this.version(n+1)` in `db.ts` and register it in `migrations.ts`.
- **Empty by default.** No fabricated user data. Sample content will be opt-in and labelled.
- **Theming.** CSS variables on `:root`, switched by `data-theme` and `data-accent`. Accent buttons use a darker terracotta (`#C0502F`) than the brand `#D76543` so white text meets WCAG AA; the brand colour is decorative only.
- **Backgrounds.** Cream, pattern, botanical, or a user photo (downscaled to ≤1600px JPEG, stored as a Blob in `mediaAssets`) with dim/blur/contrast controls.
- **Motion.** `MotionConfig` honours the OS reduce-motion setting; "Low" in Settings disables animation entirely.
- **PWA.** `vite-plugin-pwa` (Workbox generateSW, `registerType: 'prompt'`): precaches the shell, serves `index.html` for navigations offline, shows an update prompt. Install prompt only when the browser fires `beforeinstallprompt`.
- **Fonts** are self-hosted (`@fontsource-variable/*`), no CDN.

## Licences (runtime deps)

react, react-dom, react-router-dom, dexie, dexie-react-hooks, zod, motion, lucide-react: MIT/Apache-2.0 (ISC for lucide). Fraunces and Inter: SIL OFL 1.1. Illustrations: original, created for this project.

## Phase 2: inventory engine

- **Pure domain** (`src/domain`): `units.ts` (conversion tables, readable formatting) and `lots.ts` (aggregation, expiry status, low stock, FIFO consume planning). No React or Dexie imports, so it is fully unit-tested.
- **Units.** Mass (g, kg, oz, lb) and volume (ml, L, tsp, tbsp, cup, fl oz) convert within their dimension. Mass to volume converts only with an ingredient density that is stored (about 30 catalog items). Count units (pcs, pack, can, bottle) never convert to each other or to anything else. Anything unsafe returns `null`; totals list incompatible kinds side by side ("1.5 kg + 3 pcs").
- **Lots, not totals.** Every purchase is a lot with its own zone, date label (use-by / best-before / none), date and optional cost. An ingredient's amount is derived.
- **Transactions** (`src/data/inventory.ts`): add, edit, consume, transfer, discard, undo and bulk operations each run in one Dexie transaction over lots and events. Consume takes earliest-dated stock first, is all-or-nothing, refuses negative stock and incompatible units, and honours an idempotency key (unique index) so the same cooking session or purchase cannot apply twice. A test forces a failure mid-write and asserts nothing changed.
- **Undo** restores from the snapshot stored on each event and refuses if the lot changed since, so it cannot create stock.
- **Catalog.** About 100 ingredients with stable ids (`ing-tomatoes`), seeded once per catalog version, never overwriting user edits. Custom ingredients are supported.
- **Sample pantry.** Opt-in, 29 lots marked `sample: true` with dates relative to today; removal deletes only those.
- **Living Pantry** draws one sprite per ingredient in the zone from the logged data. The list view is the full-size accessible alternative.
- **Expiry wording** never claims safety; use-by and best-before are described differently and every expiry surface carries the caveat.
- **Routing detail.** The shell uses `useOutlet()` inside `AnimatePresence`. With `<Outlet/>` the incoming page mounted twice and destroyed anything opened in that window.

## Update: jars and profile picture

- **Jar sizes** (small, medium, large) are separate count units. A small jar is not a large jar, so they never merge or convert, like cans and pieces. Ajvar, pickles, olives and jam default to a medium jar. Catalog v2 refreshes the usual unit of built-in items only; existing lots and custom ingredients are untouched. Count units pluralise in display ("2 small jars").
- **Profile picture** is centre-cropped to a 256 px JPEG in the browser and stored in `mediaAssets` (kind `avatar`), referenced by `prefs.avatarId`. Replacing or removing deletes the old blob. It never leaves the device. The avatar shows in the top bar and links to Settings.
- The logo (sidebar and mobile header) links to the front page.

## Phase 3: recipes and cooking

- `domain/scaling.ts`: kitchen fractions, rounding, metric/imperial display, non-linear ingredient flag.
- `domain/recipes.ts`: pantry coverage per recipe line (uses `planConsume` on a working copy of stock), proposed deductions, search/filter/sort.
- `domain/timers.ts`: remaining time is always `endsAt - now`; nothing counts down in memory.
- `data/starterRecipes.ts`: the bundled cookbook, compiled against catalog names (a typo throws at load and in tests).
- `data/recipes.ts`: recipe CRUD, collections, cooking sessions. `finishCooking` runs inside one Dexie transaction over sessions, lots, events: a failing row rolls back everything, a finished session cannot be applied again, and each row carries an idempotency key.
- Cooking sessions persist step, ticked items and timers in the `cookingSessions` table, so a reload resumes exactly where the cook left off.
