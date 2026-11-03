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
