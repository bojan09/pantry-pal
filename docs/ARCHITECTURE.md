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
