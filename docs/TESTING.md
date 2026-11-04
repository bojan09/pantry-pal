# Testing

| Layer                                         | Tool                  | Command             |
| --------------------------------------------- | --------------------- | ------------------- |
| Unit / integration (Dexie via fake-indexeddb) | Vitest                | `npm test`          |
| Types                                         | tsc strict            | `npm run typecheck` |
| Lint                                          | ESLint + react-hooks  | `npm run lint`      |
| E2E, a11y, offline, screenshots               | Playwright + axe-core | `npm run test:e2e`  |

## Phase 1 coverage

- Unit: date math (week starts, month boundary, greeting), prefs validation/recovery/corrupt storage, Dexie open + migration record + unique idempotency key.
- E2E: no horizontal overflow on every route at 360/390/430/768/1024/1440 and landscape 844×390; onboarding (complete + skip) and persistence; desktop + mobile navigation, back controls, 44px nav targets; theme/accent persistence; custom background upload + non-image rejection; manifest + offline deep-link reload after SW install; axe WCAG A/AA on every route in light and dark, onboarding, and mobile.

Not covered yet: screen-reader manual testing, real-device performance, cross-browser (Chromium only), visual diff against the reference (screenshots are reviewed manually).

## Phase 2 coverage

- Unit (domain): conversions, density rules, count units never mixing, totals ordering, date boundaries, use-by vs best-before wording, low stock, FIFO consume planning, float-noise cases.
- Integration (fake-indexeddb): catalog seeding idempotency; add/edit validation (nothing written on rejection); multi-lot consume across lots; all-or-nothing on insufficient stock; no negative stock; incompatible units refused; density conversion; idempotency key blocks a double deduction; forced mid-transaction failure rolls back; whole and partial transfer (split conserves quantity); discard + undo, undo refused after later changes; bulk ops; custom ingredients; sample load/remove only touches samples. 57 tests total.
- E2E (44 total): add via UI and persistence across reload and offline; field validation; custom ingredient; aggregation, use, undo, partial move, discard confirm/cancel/undo, edit + history; sample load/remove; keyboard activation of shelf items; list filters, search, bulk move; expiring page sections and wording; lead-days setting; Home reflects real stock; layout at 360/390/430/768/1024/1440 (shelves, list, detail, dialog, expiring); axe WCAG A/AA on shelves, list, detail, expiring and the add dialog; pointer cursor and hover animation; Low motion disables transitions; search bar spacing.

Not covered: real-device performance of the shelf animations, screen-reader passes, storage-quota-exceeded behaviour in a real browser.

## Phase 3 coverage

- Unit: fractions/rounding/units (`scaling.test.ts`); starter recipe integrity; CRUD validation; starter read-only; collections; session resume; cancel leaves stock and events untouched; atomic finish with FIFO lots; rollback on a bad row; double-apply and concurrent-apply rejection; availability statuses and shared-stock handling (`recipes.test.ts`).
- E2E (`e2e/recipes.spec.ts`): search/filter/sort, favourites, scaling, create/edit/delete, duplicate, collections, offline recipe, full cook-through with confirm, stop cooking, timers across reload, phone swipe, axe on recipes/detail/form/collections/history/cooking.

## Phase 4 coverage

- Unit: `domain/shopping` maths through `planShop.test.ts` (consolidation, shared stock, unit mismatch, optional lines, merging, ticked ≠ stocked), planner CRUD/validation/move/duplicate, recipe deletion keeps plans, atomic purchase and rollback.
- E2E (`e2e/planner.spec.ts`): plan/edit/move/duplicate/remove, drag and drop, week navigation, plan → list → purchase → pantry, lists lifecycle, recipe → list, axe, phone width.

## Phase 5 coverage

- Unit: matching (tiers, partial credit, use-soon, past use-by, point deltas, determinism) and analytics (reconciliation of every bucket, undone/cancelled exclusion, currency separation, used-before-date evidence).
- E2E (`e2e/phase5.spec.ts`, `e2e/limits.spec.ts`): ranking and explanation, allergen/diet filters, past-use-by, analytics totals vs sample data, flourish vs Low/reduce-motion, lazy chunks, axe.

## Phase 6 coverage

- Unit: backup export/parse/preview/restore (round trip, merge vs replace, checksum, forged-checksum structural attacks, reference checks, oversized text, rollback on failure, wipe), CSV escaping and formula neutralising, exports, error messages, planner/recipe additions.
- E2E (`e2e/release.spec.ts`): backup → delete everything → restore (prefs, data, favourites), rejected files leave data intact, merge, photo round trip across devices, CSV download, privacy/notification/storage UI, backup reminder logic, strict-CSP run of every screen with a network check, hostile text, offline use of every screen, keyboard/focus/dialog smoke, axe in 2 themes × 4 accents on 8 screens, overflow and target-size checks at 9 viewport sizes including landscape.
- `npm run check:budget`: fails when initial JS, CSS, any lazy chunk or the offline cache grows past the budget.
- `npm audit --omit=dev`: 0 vulnerabilities at release.
