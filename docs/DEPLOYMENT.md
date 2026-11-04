# Deploying PantryPal

PantryPal is a static site: `npm run build` produces a `dist/` folder that any static host can serve. There is no server, database or secret to configure.

## Requirements for any host

1. **HTTPS.** Service workers and installation only work on HTTPS (or `localhost`).
2. **Single-page fallback.** Every path that is not a file must return `index.html` (so `/recipes/garden-frittata` works on reload and as a first visit).
3. **Do not cache `sw.js` hard.** Serve `/sw.js` with `Cache-Control: no-cache` so new versions are noticed.
4. **Security headers** (recommended, already defined for Vercel in `vercel.json`):
   `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`. The CSP is strict (`script-src 'self'`, no eval, no third-party origins). The app has been tested under exactly this policy (`vite preview` serves the same headers).

## Vercel (what this project uses)

- Import the GitHub repository; framework preset **Vite**; build command `npm run build`; output `dist`.
- `vercel.json` already contains the SPA rewrite, the headers and the `sw.js` rule.
- Every push to `master` is a production deploy. There are no environment variables.

## Netlify

- Build command `npm run build`, publish directory `dist`.
- Add a `public/_redirects` file containing `/*  /index.html  200` and a `public/_headers` file mirroring the headers in `vercel.json`:

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  X-Frame-Options: DENY
/sw.js
  Cache-Control: no-cache
```

## GitHub Pages

GitHub Pages cannot set headers or do SPA rewrites for clean URLs, so use it only as a fallback:

- Build with `base` set to the repository path (`vite build --base=/<repo>/`) and change `start_url`/`scope` in `vite.config.ts` to the same path.
- Copy `dist/index.html` to `dist/404.html` so deep links fall back to the app.
- The CSP can be added as a `<meta http-equiv="Content-Security-Policy">` tag, with the limits of meta CSP.

## Cloudflare Pages / any other static host

Same three requirements: HTTPS, rewrite to `index.html`, `no-cache` on `sw.js`.

## Before every release

```
npm run verify          # lint, typecheck, unit tests, production build, bundle budget
npm run test:e2e        # full browser suite (starts its own preview server)
npm run licenses        # refresh docs/LICENSES.md
npm audit --omit=dev    # production dependency vulnerabilities
```

## After deploying

- Open the site, reload once, switch to airplane mode, reload again: the app must still open.
- Check the response headers of `/` (CSP present) and that `/sw.js` has `Cache-Control: no-cache`.
- Install the app (browser menu → Install app, or Share → Add to Home Screen on iOS).

## Updating users

The service worker uses a prompt strategy: a new version is downloaded in the background and the user sees "A new version is ready" with an **Update** button. Nothing reloads under them while they are cooking. User data lives in IndexedDB and is not touched by updates; schema changes go through versioned Dexie migrations (`src/data/db.ts`, `src/data/migrations.ts`).
