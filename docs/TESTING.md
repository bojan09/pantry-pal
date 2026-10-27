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
