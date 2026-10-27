# PantryPal — Master Plan

Status: **APPROVED — Phase 1 delivered, awaiting review. Phases 2–6 pending.**
Source of truth: `PantryPal_MASTER_PROMPT.md` + `docs/design/reference.webp`.

## Approved decisions (supersede anything below)

- Food/pantry visuals: **original SVG illustrations** (no photos). Recipe `imageId` slot kept for user-supplied photos.
- Hosting: **Vercel** (static, `vercel.json` SPA rewrites). Vite `base` stays `/`.
- Fonts: Fraunces + Inter, self-hosted via `@fontsource-variable` (OFL).
- **English only.** No Macedonian, no language switching, no i18n framework. UI strings are inline; dates/numbers use `Intl` with `en`. All "EN/MK" tasks in the phases below are dropped, including the Phase 6 localization audit.
- Single branch: **`master` only**, pushed directly (treated as production).
- Onboarding sample-pantry option deferred: it is added in Phase 2 when there is inventory to seed.

## 1. Summary

Offline-first, privacy-first PWA kitchen assistant. React + Vite + TypeScript + Tailwind, Dexie/IndexedDB, vite-plugin-pwa, Motion, Recharts. No backend, no accounts, no paid services. English + Macedonian (Cyrillic). Six phases, each committed to `master` and pushed, then stop for review.

## 2. Repository state (facts)

- `bojan09/pantry-pal`: empty, no commits, local branch `master` (unborn). Nothing to preserve.
- Toolchain: Node 22.22, npm 10.9. Chromium + Playwright preinstalled (use for E2E + screenshots).
- Work only on `master`. First push creates `origin/master`.

## 3. Deviations / risks needing your decision

| #   | Issue                                                                                                                              | Recommendation                                                                                                                                                                                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Reference shows soft food **photography**. I cannot source licensed photos offline, and scraping/stock is prohibited by the brief. | Ship **original illustrated SVG food art** (warm, flat-texture editorial style) for recipes/ingredients/pantry scene. Photo slots are built so you can drop in your own licensed photos later (per-recipe `image` field, graceful fallback to illustration). Alternative: you supply photos. |
| 2   | Brief says "TypeScript preferred".                                                                                                 | TypeScript strict.                                                                                                                                                                                                                                                                           |
| 3   | Fonts must work offline.                                                                                                           | Self-host open-license fonts (e.g. Fraunces serif + Inter sans, both OFL) via `@fontsource`; no Google CDN.                                                                                                                                                                                  |
| 4   | Brief: no mock quantities as user data. Reference shows "24 ingredients, Tomatoes 2 days".                                         | Real app starts **empty** after onboarding; "Load sample pantry" is opt-in and labeled **Sample**.                                                                                                                                                                                           |
| 5   | Macedonian translations quality.                                                                                                   | I write them; flag for native review before release.                                                                                                                                                                                                                                         |
| 6   | Notifications cannot fire when PWA is closed (no server).                                                                          | In-app alerts + opt-in Notification API; limitation documented in UI.                                                                                                                                                                                                                        |
| 7   | Drag-and-drop in Phase 4.                                                                                                          | `@dnd-kit` (MIT) + accessible Move buttons.                                                                                                                                                                                                                                                  |

Strongest counter-argument to the stack: Dexie + custom domain layer is more code than a simple store. Kept because lot-based inventory with atomic multi-lot deductions needs real transactions. Would change if scope were cut to simple per-ingredient counts.

## 4. Architecture

```
src/
  app/            routes, shell, providers
  design/         tokens, primitives (Button, Card, Chip, Sheet, Dialog, Toast…), illustrations
  features/
    home/ pantry/ recipes/ cooking/ planner/ shopping/
    expiring/ analytics/ collections/ settings/ onboarding/
  domain/         PURE TS, no React/Dexie: units, conversion, lots, matching, scaling, shopping calc, expiry
  data/           Dexie db, schema versions, migrations, repositories, transactions, seed (starter recipes/catalog)
  i18n/           en.json, mk.json, formatters, plurals (Intl)
  lib/            dates, ids (UUID), validation (zod), backup, csv
  tests/          unit, integration (fake-indexeddb), e2e (Playwright)
docs/             ARCHITECTURE, DESIGN_REFERENCE, TESTING, PHASE_REPORTS, design/reference.webp
```

Key decisions:

- **Domain layer is pure** and fully unit-tested; UI/DB call into it.
- **Units:** mass (g, kg, oz, lb), volume (ml, l, tsp, tbsp, cup, fl oz), count (pcs, + custom packs). Conversion only within a dimension. g↔ml only with explicit per-ingredient density; otherwise **incompatible → reported, never summed**.
- **Inventory = lots.** Quantities stored in canonical base unit + display unit. All stock mutations go through one transactional `applyInventoryOps()` writing `inventoryEvents`; negative stock rejected; idempotency key per cooking session / purchase to prevent double deduction.
- **Matching:** deterministic, explainable score = coverage + amount availability + expiry urgency + prefs + time + favorites; returns per-ingredient reasons. Ready / Nearly ready / Missing.
- **Timers:** persisted `endsAt` timestamps; remaining = endsAt − now; survive refresh/tab sleep.
- **Validation:** zod at all import/form boundaries. No `dangerouslySetInnerHTML`, no eval.
- **Backup:** versioned JSON + SHA-256 checksum, preview before restore, replace/merge.
- **State:** Dexie `liveQuery` (dexie-react-hooks) for data; small context for UI prefs (localStorage). No Redux.
- **Router:** react-router (hash-less), lazy routes.
- **Deps (all MIT/Apache/OFL, to be license-checked in docs):** react, react-router, dexie, dexie-react-hooks, zod, motion, recharts, @dnd-kit, vite-plugin-pwa, tailwindcss, @fontsource/*, vitest, @testing-library/react, fake-indexeddb, playwright, @axe-core/playwright, eslint, prettier.

## 5. Design system (from reference)

Tokens: cream `#FFF9EF`, oat `#F1E4CE`, terracotta `#D76543`, sage `#74866B`, saffron `#E8B95D`, charcoal `#292C25`; dark theme variant; 4 accent palettes; 3 background treatments (solid, pattern, botanical) + custom photo with dim/blur/contrast.
Type: Fraunces display, Inter UI. Radii large/organic, soft warm shadows.
Desktop: illustrated left rail (Home, My Pantry, Recipes, Meal Planner, Shopping List, Expiring Soon, Analytics, Collections, Settings, EN/MK + theme toggle), hero greeting + "Cook with what you have" card with chips, Pantry/Fridge/Freezer tabs over illustrated shelf scene, expiring panel, suggested recipes row, week strip, quote card.
Mobile: bottom nav (Home, Pantry, Recipes, Planner, More), safe-area padding, 44px targets, back button on every sub-page.
QA: Playwright screenshots at 360/390/430/768/1024/1280/1440/1920, side-by-side vs reference stored in `docs/design/`.

## 6. Phases

Each phase ends with: lint → typecheck → unit/integration → build → E2E/a11y/visual → fix → diff + secret scan → commit on `master` → push → verify remote → report → **STOP**.

### Phase 1 — Foundation, design system, PWA shell

Vite+React+TS+Tailwind scaffold; tokens + fonts; primitives; desktop rail + mobile nav; all routes with real (empty-state) pages; back-nav; i18n EN/MK skeleton with switching; theme/accent/background prefs persisted; Dexie schema v1 + migration harness; manifest + service worker + offline shell + icons; onboarding (language, units, currency, household, diet, sample-or-empty); vitest, fake-indexeddb, Playwright, axe harness; docs.
Accept: no horizontal overflow at 360/390/430/768/1024/1440; nav/back work; EN↔MK switches; offline shell reloads; all checks green; no severe axe errors.

### Phase 2 — Living Pantry + inventory engine

Ingredient catalog (EN/MK names, aliases, categories, density where known); custom ingredients; lots CRUD; add/edit/consume/transfer/discard with confirm; events log; low-stock; expiry metadata (use-by vs best-before); SVG Living Pantry (pantry/fridge/freezer) + accessible list view; search/filter/sort/bulk.
Accept: multi-lot aggregation; incompatible units never merge; ops atomic; persists offline; keyboard parity.

### Phase 3 — Recipes + Cooking Mode

~30 original starter recipes (own text, illustrated art) offline; recipe CRUD, collections, favorites, search/filter; servings scaling w/ fractions; recipe detail; Cooking Mode (step cards, swipe/keys, checklist, multi-timer w/ persisted timestamps, wake lock); finish → editable per-lot deduction → atomic confirm; cooking history.
Accept: scaling correctness; timers survive refresh; cancel leaves stock unchanged; deduction atomic + idempotent.

### Phase 4 — Meal planner + shopping

Week/day planner with slots; schedule/duplicate/move/servings; dnd + accessible controls; demand calc; multiple shopping lists; generation = required − available − already listed (unit-safe, shown transparently); categories; manual items; optional prices/budget per currency; purchase→pantry confirmation flow.
Accept: multi-plan aggregation; no silent pantry changes; no double-count.

### Phase 5 — Smart matching, analytics, polish

Explainable ranking + Ready/Nearly/Missing; use-soon boost (no safety claims); preference/allergen filters (informational); editorial infographics from real records only; Living Pantry animations; cooking flourish; motion presets + reduced-motion; perf modes; lazy loading.
Accept: stats reconcile with records; no fake data; reduced motion respected.

### Phase 6 — Release hardening

Full EN/MK coverage audit; settings completion; backup/restore (checksum, preview, malformed-reject, roundtrip); CSV export; update prompt + install UX; notification help; privacy page; full regression, responsive screenshots, axe, keyboard smoke, bundle budget; license doc; static-hosting deploy guide (GitHub Pages/Netlify/Vercel free); release report.

## 7. Testing matrix

Unit (domain), integration (Dexie via fake-indexeddb: transactions, migrations), E2E Playwright (journeys, EN/MK, light/dark, offline via context.setOffline, widths 360–1440 + landscape), axe, reduced-motion, import fuzz/malformed, date boundaries, quota error handling. Only real, executed results get reported.

## 8. Open questions (answer before Phase 1)

1. Food visuals: **illustrated SVG** (recommended) or will you supply photos?
2. Deploy target for later (GitHub Pages assumed; affects Vite `base`)?
3. OK to use Fraunces + Inter (OFL, self-hosted)?
4. Macedonian: Cyrillic only, I draft, you review?

## 9. Deliverable cadence

Plan approval → Phase 1 → your inspection → Phase 2 → … Never auto-advance.
