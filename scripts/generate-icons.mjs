// Renders public/icons/*.png from inline SVG using Playwright's Chromium.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const hat = `<path d="M18 30c-6-1-10-6-10-12 0-7 6-12 13-11 3-4 8-6 12-5 4-1 9 1 11 5 7-1 14 4 14 11 0 6-4 10-9 11v13H18V30z" fill="#D76543"/><path d="M18 30s6 3 14 3 14-3 14-3" stroke="#FFF9EF" stroke-width="2" stroke-linecap="round" opacity=".55" fill="none"/><rect x="18" y="42" width="28" height="9" rx="3" fill="#C0502F"/><path d="M24 42v9M32 42v9M40 42v9" stroke="#FFF9EF" stroke-width="1.6" opacity=".45"/>`;
const svg = (inner, bg = true, scale = 1) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="512" height="512">${bg ? '<rect width="64" height="64" fill="#FFF9EF"/>' : ''}<g transform="translate(${32 - 32 * scale} ${32 - 32 * scale}) scale(${scale})">${inner}</g></svg>`;

const jobs = [
  ['icon-192.png', 192, svg(hat, true, 0.82)],
  ['icon-512.png', 512, svg(hat, true, 0.82)],
  ['maskable-512.png', 512, svg(hat, true, 0.6)], // extra padding for the maskable safe zone
  ['apple-touch-icon.png', 180, svg(hat, true, 0.82)],
];

mkdirSync('public/icons', { recursive: true });
const browser = await chromium.launch();
for (const [name, size, markup] of jobs) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<style>html,body{margin:0}svg{width:${size}px;height:${size}px;display:block}</style>${markup}`,
  );
  writeFileSync(`public/icons/${name}`, await page.screenshot({ type: 'png' }));
  await page.close();
}
await browser.close();
console.log('icons generated');
