# Phase reports

## Phase 1 — Foundation, design system, PWA shell

Status: delivered, awaiting review. Details of the final run are in the commit message and the hand-off message.

Scope: Vite/React/TS/Tailwind scaffold, design tokens + primitives, responsive shell, all routes with empty states, onboarding, Settings (theme, accent, backgrounds, motion, units, currency, week start, diet/allergens, install), Dexie schema v1 + migration registry, PWA (manifest, icons, offline shell, update prompt), test harness, docs.

Limitations: Chromium-only E2E; Living Pantry is empty shelves; no photography; backup/restore not yet built.

## Phase 2: Living Pantry and inventory engine

Status: delivered, awaiting review.

Scope: ingredient catalog + custom ingredients; lot-based inventory with add/edit/use/move/discard/undo/bulk; units with safe conversion; expiry and low-stock logic; inventory history; Living Pantry shelves + list view; ingredient detail page; real Expiring Soon page; Home wired to real stock; sample pantry; settings for expiry lead days. Also fixed: top-bar spacing, pointer cursors and press/hover animation on all interactive elements, invalid SVG paths in the sprig art, and a double page mount on route changes.

Limitations: dates are local calendar dates; no notifications yet (Phase 6); no recipe-based deductions yet (Phase 3); shelf scene shows up to 24 ingredients per zone (rest in list view); shelf item tap targets are small on phones (the list view has full-size targets).

### Phase 2 follow-up

Added jar-size units (ajvar, pickles, olives, jam default to medium jar), logo links home on desktop and mobile, local profile picture (Settings, top bar). Tests now: 59 unit/integration, 51 E2E.

## Phase 3: Recipe library and Cooking Mode

Status: delivered, awaiting review.

Scope:
- 33 original starter recipes (own text, bundled SVG art, all offline), seeded once into IndexedDB and refreshed by `STARTER_VERSION` without losing favourites.
- Recipe CRUD for personal recipes (photo upload, ingredients with unit, optional flag, ordered steps with optional timers, notes), duplicate-to-edit for starters, custom ingredients created from the form.
- Favourites, collections (create/rename/delete, add from the recipe page, filter the cookbook by collection), search (name, summary, tags, cuisine, ingredient names and aliases), filters (category, cuisine, difficulty, total time, favourites, "I can make it now") and sorting (name, time, favourites, recently cooked).
- Servings scaling with kitchen fractions and sensible rounding, metric/imperial display, "≈" flags on spices/salt/leavening and a note that times may not scale linearly.
- Pantry coverage per ingredient (in pantry / have X / not in pantry / check units). Lines are checked against a working copy of stock so two lines never claim the same grams.
- Cooking Mode: one step per card, swipe/tap/arrow keys, progress bar, jump-to-step, ingredient checklist, multiple timers stored as end timestamps (survive reload and tab sleep), chime and vibration while the app is open, screen wake lock where supported, resumable session.
- Finish flow: editable per-ingredient amounts and units, pre-validated against stock, optional rating and notes, applied in one transaction. "Finish without changing pantry" and "Stop cooking" never touch stock.
- Cooking history page.
- Sample content now only covers the meal-plan preview (recipes are real).

Decisions and limits:
- Deductions are edited per ingredient and applied earliest-date-first across lots (the lot breakdown is not shown). The brief asked for per-lot editing; per-ingredient keeps the dialog short and the result predictable. Say if you want a per-lot view.
- Timers have no pause, only cancel. Alerts need the app open; closed-app notifications are not possible without a server (Phase 6 will add the opt-in permission UI).
- No "undo cooking" yet (inventory history shows the events and lots can be corrected by hand).
- Recipe import/export is deferred to Phase 6 with backup/restore.
- Add-missing-to-shopping-list arrives with the shopping list in Phase 4.

Tests: 82 unit/integration (scaling, availability, atomic finish, rollback, double-apply, cancel, starter integrity), E2E for cookbook, CRUD, collections, offline, cook-through, cancel, timers across reload, phone swipe, axe on every new page.

### Phase 3 follow-up: timer pause

Timers can now be paused and resumed. A paused timer stores the time left and survives reloads. Tests: 87 unit/integration at that point.

## Phase 4: Meal planner and shopping lists

Status: delivered, awaiting review.

Scope:
- Week planner: breakfast/lunch/dinner/snack plus custom meal names, recipe or free-text notes (e.g. "Leftovers", never counted as stock or needs), servings per entry, week navigation, mark done, cook straight from an entry (finishing marks it done).
- Moving: drag and drop between days/meals on pointer devices, plus an Edit dialog with date/meal fields, previous/next day buttons and duplicate for keyboard and phone.
- Shopping generation (from the planner week or a single recipe): needs = recipes − pantry − already on the list. Shown line by line with the arithmetic before anything is written. Optional ingredients are not added; stock in an unrelated unit is not subtracted and is flagged; stock is drawn down as rows are processed so the same pantry grams are never counted twice. Repeated generation merges into existing items.
- Lists: multiple lists, manual items, edit/delete, categorised view, check/uncheck, share (native share or copy as text), per-list currency and optional budget, optional price per kg / L / piece with an estimate, "over/under budget", no cross-currency sums.
- Buying: ticked items go to the pantry only through a confirmation dialog (amount, unit, place, date). Atomic, one purchase per item, cost carried to the lot, `purchase` events logged.
- Deleting a recipe keeps its planned meals as notes. Sample content removed everywhere (nothing is invented any more); Home shows the real week.

Decisions and limits:
- Drag and drop uses the browser's native API (no extra dependency), which does not work with touch; the Edit dialog is the touch alternative.
- Prices are per kg, per L or per counted unit and are estimates the user typed.
- Meals marked done are excluded from shopping generation; a planned meal in the past that was not marked done still counts.
- Not done: reordering within a cell (entries keep creation order), a month view, recurring plans, template weeks.

Tests: 100 unit/integration (planner CRUD/validation, needs maths, merging, price estimate, atomic purchase and rollback), E2E for planning, moving, drag and drop, week navigation, generation, lists, budget, copy, purchase into pantry, axe.
