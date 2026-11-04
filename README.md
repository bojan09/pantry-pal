# PantryPal — Your Kitchen, Organized

Offline-first, privacy-first kitchen assistant (PWA): pantry, recipes, cooking mode, meal planner and shopping lists. No account, no backend, no tracking; data lives in your browser (IndexedDB).

**Status:** all 6 phases delivered. Release report: `docs/RELEASE_REPORT.md`. Plan and history: `MASTER_PLAN.md`, `docs/PHASE_REPORTS.md`. Privacy: `docs/PRIVACY.md`. Deployment: `docs/DEPLOYMENT.md`. Licenses: `docs/LICENSES.md`.

## Develop

```bash
npm install
npm run dev          # http://localhost:5173
npm run typecheck && npm run lint && npm test
npm run verify       # lint, typecheck, unit tests, build, bundle budget
npm run test:e2e     # E2E builds + serves the production bundle (with the real CSP) on :4173
npm run icons        # regenerate PWA icons (needs Playwright Chromium)
```

Node 22+. Playwright is pinned to the version matching the preinstalled Chromium; if you use a different local browser build, run `npx playwright install chromium`.

## Deploy (Vercel)

Other hosts and requirements: `docs/DEPLOYMENT.md`. Import the repo in Vercel: framework preset **Vite**, build `npm run build`, output `dist`. `vercel.json` rewrites SPA routes to `index.html` and keeps `sw.js` uncached so updates ship. Pushing to `master` deploys production.

## Stack

React 19, Vite, TypeScript (strict), Tailwind v4, react-router, Dexie, zod, Motion, lucide-react, vite-plugin-pwa. All MIT/Apache/OFL licensed (see `docs/ARCHITECTURE.md`).
