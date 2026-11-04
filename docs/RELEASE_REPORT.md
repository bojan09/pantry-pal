# PantryPal release report

Version 0.1.0 · all six phases delivered on `master` · English only (Macedonian/i18n dropped by decision).

## What shipped

| Phase | Scope                                                                                                                                                                         |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Design system, responsive shell, routes, onboarding, themes/accents/backgrounds, Dexie schema + migrations, PWA shell                                                         |
| 2     | Living Pantry, lot-based inventory, safe unit conversion, expiry/low-stock, history, undo, sample pantry                                                                      |
| 3     | 33 starter recipes, recipe CRUD, collections, scaling, Cooking Mode with persisted timers (pause/resume), confirm-before-deduct, per-lot choice, undo, history, import/export |
| 4     | Meal planner (week/month, drag, touch drag, reorder, repeat, copy week), shopping lists with transparent maths, prices/budget, purchase → pantry                              |
| 5     | Explainable matching and ranking, allergen/diet filters, analytics, motion presets, cooking flourish                                                                          |
| 6     | Backup/restore, CSV, privacy and data controls, storage info, notification help, install help, strict CSP, hardening, performance budget, licenses, deployment guide          |

## Verification

| Check                                       | Result                                                                                                                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint (ESLint 10, react-hooks)               | clean                                                                                                                                                                     |
| Typecheck (TypeScript 6 strict)             | clean                                                                                                                                                                     |
| Unit + integration (Vitest, fake-indexeddb) | 152 passing                                                                                                                                                               |
| Browser E2E (Playwright, Chromium)          | 119 passing on the final run                                                                                                                                              |
| Accessibility (axe, WCAG 2 A/AA)            | no serious/critical findings on every main screen; contrast checked in light and dark × 4 accents on 8 screens                                                            |
| Offline                                     | every screen and deep link reload offline after one visit; backup also works offline                                                                                      |
| Responsive                                  | no horizontal overflow and no target under 24px at 360, 390, 430, 768, 1024, 1440, 1920 and two landscape sizes                                                           |
| Security                                    | strict CSP (no eval, no third-party origins) enforced during all tests; no request leaves the site; hostile text shown as text; `npm audit --omit=dev`: 0 vulnerabilities |
| Bundle                                      | initial JS 213 KB gzip (budget 225), CSS 9 KB, every lazy chunk ≤ 12 KB, offline cache 1.3 MB                                                                             |
| Licenses                                    | 19 production packages, all permissive (MIT, Apache-2.0, ISC, 0BSD, OFL-1.1); `docs/LICENSES.md`                                                                          |
| Secrets / paid services                     | none in the repo; no paid dependency, backend or tracker                                                                                                                  |

## Bugs found and fixed during the hardening pass

- **Backup of photos failed in a real browser** (awaiting non-database work inside an IndexedDB transaction). Reading now happens in one transaction; encoding happens after.
- **Recipes saved without a description lacked a `summary`**, which made a backup of them invalid. Now always stored; the backup reader also tolerates old data.
- **zod probed for `eval`**, violating the strict CSP on every page load. All schemas now come from one eval-free module, enforced by ESLint.
- **Early "Load sample pantry"** (before start-up seeding finished) could fail. Seeding is now one transaction and the sample load waits for it and is all-or-nothing.
- **Form error was not announced** (focus moved before the message existed). Focus now follows the message.
- **Danger buttons failed contrast in dark mode.** New `bad-ink` token.
- Small targets: sample-pantry link and ingredient links enlarged.
- **Cooking finish flourish never showed** when the session completed first (found in Phase 5).

## Known limits (honest list)

- **Closed-app alerts are impossible** without a server: timers ring and notify only while PantryPal is open. Stated in the UI.
- **Data is device-local.** The browser can clear it; backups are the safeguard. Backups are not encrypted.
- **Chromium only** in automated tests. Firefox/Safari behaviour (storage persistence, wake lock, notifications, install) is covered by feature detection and fallbacks but was not run in those browsers here.
- **No frame-rate measurement on real mid-range phones** was possible. Motion uses transforms/opacity and can be set to Low.
- **English only.** The Macedonian/i18n requirement was dropped by the owner.
- Matching weights are a documented judgement, not learned.
- Remaining food photography: the app ships original SVG illustrations; users can add their own recipe photos.
- iOS: web notifications need the app added to the Home Screen; Add to Home Screen is explained in Settings.
- Not built: multi-device sync (by design), accounts, barcode scanning, nutrition data.

## Manual checks still recommended before announcing

1. Install on a real Android and iPhone and use it for a day (offline, timers in a pocket, Add to Home Screen).
2. Test restore on a second browser.
3. Screen-reader pass (VoiceOver/TalkBack/NVDA) on the cooking flow. Automated axe and keyboard checks pass, but they are not a substitute.
