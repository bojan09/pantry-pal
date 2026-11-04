// Fails when the production build grows past the agreed size budget.
// Run after `npm run build`:  node scripts/check-budget.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const KB = 1024;
const BUDGET = {
  initialJsGz: 225 * KB, // JS needed before the first screen (react, router, dexie, zod, shell, home)
  initialCssGz: 15 * KB,
  lazyChunkGz: 60 * KB, // each route loaded on demand
  totalPrecache: 2.2 * 1024 * KB, // everything cached for offline use
};

const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
const gz = (p) => gzipSync(readFileSync(join(DIST, p.replace(/^\//, '')))).length;

const initialJs = refs.filter((r) => r.endsWith('.js'));
const initialCss = refs.filter((r) => r.endsWith('.css'));
const sum = (list) => list.reduce((n, p) => n + gz(p), 0);

const all = readdirSync(join(DIST, 'assets')).map((f) => `/assets/${f}`);
const lazy = all.filter((f) => f.endsWith('.js') && !initialJs.includes(f));

let total = 0;
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (!/\.map$|sw\.js$|workbox-/.test(f)) total += statSync(p).size;
  }
};
walk(DIST);

const rows = [
  ['Initial JavaScript (gzip)', sum(initialJs), BUDGET.initialJsGz],
  ['Initial CSS (gzip)', sum(initialCss), BUDGET.initialCssGz],
  ['Everything cached for offline', total, BUDGET.totalPrecache],
  ...lazy.map((f) => [`Lazy chunk ${f.split('/').pop()} (gzip)`, gz(f), BUDGET.lazyChunkGz]),
];
let fail = false;
for (const [name, size, max] of rows) {
  const ok = size <= max;
  if (!ok) fail = true;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(58)} ${(size / KB).toFixed(1).padStart(8)} KB / ${(max / KB).toFixed(0)} KB`);
}
if (fail) {
  console.error('\nBundle budget exceeded.');
  process.exit(1);
}
console.log('\nBundle budget respected.');
