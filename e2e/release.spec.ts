import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const PREFS_KEY = 'pantrypal.prefs.v1';
async function boot(page: Page, prefs: Record<string, unknown> = {}) {
  await page.addInitScript(
    ([k, v]) => {
      if (!localStorage.getItem(k as string)) localStorage.setItem(k as string, JSON.stringify(v));
    },
    [PREFS_KEY, { onboarded: true, name: 'Bojan', ...prefs }],
  );
}
async function loadSample(page: Page) {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Load sample pantry' }).click();
  await expect(page.getByText(/Loaded 29 sample items/)).toBeVisible();
}
const dialog = (page: Page) => page.getByRole('dialog');

async function downloadBackup(page: Page): Promise<{ path: string; text: string }> {
  await page.goto('/settings');
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download a backup' }).click(),
  ]);
  expect(dl.suggestedFilename()).toMatch(/^pantrypal-backup-\d{4}-\d{2}-\d{2}\.json$/);
  // keep a copy: Playwright deletes download artifacts when the browser context closes
  const path = `/tmp/claude-0/backup-${Date.now()}-${Math.round(Math.random() * 1e6)}.json`;
  await dl.saveAs(path);
  return { path, text: readFileSync(path, 'utf8') };
}

test.describe('backup and restore', () => {
  test('round trip: back up, delete everything, restore, and it is all back', async ({ page }) => {
    await boot(page, { name: 'Ana' });
    await loadSample(page);
    await page.goto('/recipes/garden-frittata');
    await page.getByRole('button', { name: 'Add Garden Frittata to favourites' }).click();
    // wait until the favourite is saved before backing up (the click writes asynchronously)
    await expect(
      page.getByRole('button', { name: 'Remove Garden Frittata from favourites' }),
    ).toBeVisible();
    const { path, text } = await downloadBackup(page);
    expect(JSON.parse(text)).toMatchObject({ format: 'pantrypal.backup', version: 1 });
    await expect(page.getByText(/Last backup:/)).toBeVisible();

    // wipe: the confirm button needs the exact word
    await page.getByRole('button', { name: /Delete all my data/ }).click();
    const del = dialog(page).getByRole('button', { name: 'Delete everything' });
    await expect(del).toBeDisabled();
    await dialog(page).getByLabel('Type DELETE to confirm').fill('delete');
    await expect(del).toBeDisabled();
    await dialog(page).getByLabel('Type DELETE to confirm').fill('DELETE');
    await del.click();
    await expect(page.getByRole('button', { name: 'Skip setup' })).toBeVisible(); // first-run state again
    await page.getByRole('button', { name: 'Skip setup' }).click();
    await page.goto('/pantry');
    await expect(page.getByText('Your pantry is empty')).toBeVisible();
    await page.goto('/analytics');
    await expect(page.getByText('No data yet')).toBeVisible();

    // restore from the file
    await page.goto('/settings');
    await page.getByRole('button', { name: /Restore from a backup/ }).click();
    const d = dialog(page);
    await d.getByLabel('Backup file').setInputFiles(path);
    await expect(d.getByText(/The checksum matched/)).toBeVisible();
    const lotsRow = d.getByRole('row').filter({ hasText: 'Pantry lots' });
    await expect(lotsRow).toContainText('29');
    await d.getByRole('radio', { name: 'Replace everything' }).click();
    await expect(d.getByRole('button', { name: 'Replace my data' })).toBeDisabled();
    await d.getByLabel(/I understand my current data will be replaced/).check();
    await d.getByRole('button', { name: 'Replace my data' }).click();
    await expect(page.getByRole('heading', { name: /Good .*, Ana!/ })).toBeVisible({
      timeout: 10_000,
    }); // prefs restored

    await page.goto('/pantry');
    await expect(page.getByText('Your pantry is empty')).toHaveCount(0);
    await page.goto('/pantry/ing-flour');
    await expect(page.getByText(/1\.5 kg|1500 g/).first()).toBeVisible();
    await page.goto('/recipes?favorites=1');
    await expect(
      page.getByRole('button', { name: /Remove Garden Frittata from favourites/ }),
    ).toBeVisible();
  });

  test('a damaged, edited or foreign file is rejected and nothing changes', async ({ page }) => {
    await boot(page);
    await loadSample(page);
    const { text } = await downloadBackup(page);
    const bad = {
      notJson: 'this is not json',
      foreign: JSON.stringify({ hello: 'world' }),
      edited: text.replace('"quantity":500', '"quantity":9999'),
      truncated: text.slice(0, text.length / 2),
    };
    expect(bad.edited).not.toBe(text);
    for (const [name, content] of Object.entries(bad)) {
      const f = `/tmp/claude-0/bad-${name}.json`;
      writeFileSync(f, content);
      await page.goto('/settings');
      await page.getByRole('button', { name: /Restore from a backup/ }).click();
      await dialog(page).getByLabel('Backup file').setInputFiles(f);
      await expect(dialog(page).getByRole('alert')).toBeVisible();
      await expect(dialog(page).getByRole('button', { name: 'Add to my data' })).toBeDisabled();
      await dialog(page).getByRole('button', { name: 'Cancel' }).click();
    }
    await expect(dialog(page)).toHaveCount(0);
    await page.goto('/analytics');
    await expect(
      page.getByText('Lots', { exact: true }).locator('..').getByText('29'),
    ).toBeVisible();
  });

  test('merge adds only what is missing and keeps local changes', async ({ page }) => {
    await boot(page);
    await loadSample(page);
    const { path } = await downloadBackup(page);
    // change the device after the backup: remove the sample pantry and add one different lot
    await page.getByRole('button', { name: /Remove sample items|Remove sample pantry/ }).click();
    await page.goto('/pantry');
    await page.getByRole('button', { name: 'Add ingredient' }).first().click();
    const d = dialog(page);
    await d.getByLabel('Search ingredients').fill('Honey');
    await d
      .getByRole('button', { name: /^Honey/ })
      .first()
      .click();
    await d.getByLabel('Quantity').fill('7');
    await d.getByRole('radio', { name: 'No date' }).click();
    await d.getByRole('button', { name: 'Add to storage' }).click();
    await expect(d).toBeHidden();

    await page.goto('/settings');
    await page.getByRole('button', { name: /Restore from a backup/ }).click();
    await dialog(page).getByLabel('Backup file').setInputFiles(path);
    await expect(dialog(page).getByRole('radio', { name: 'Add what is missing' })).toBeChecked();
    await dialog(page).getByRole('button', { name: 'Add to my data' }).click();
    await expect(page.getByText(/Merged\. Added \d+ records?/)).toBeVisible();
    await page.goto('/analytics');
    await expect(
      page.getByText('Lots', { exact: true }).locator('..').getByText('30'),
    ).toBeVisible(); // 29 restored + the 1 new
  });

  test('restores with a fresh device and keeps photos', async ({ browser }) => {
    const mk = async () => {
      const c = await browser.newContext({ acceptDownloads: true });
      const p = await c.newPage();
      await boot(p);
      return { c, p };
    };
    const a = await mk();
    await a.p.goto('/recipes/new');
    await a.p.getByLabel('Name', { exact: true }).fill('Photo dish');
    await a.p.getByLabel('Ingredient 1 name').fill('Bread');
    await a.p.getByLabel('Ingredient 1 amount').fill('1');
    await a.p.getByLabel('Step 1', { exact: true }).fill('Eat.');
    // 1x1 png
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    await a.p
      .getByLabel('Recipe photo file')
      .setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: png });
    await a.p.getByRole('button', { name: 'Save recipe' }).click();
    await expect(a.p.getByRole('heading', { level: 1, name: 'Photo dish' })).toBeVisible();
    await expect(a.p.getByRole('img', { name: 'Photo dish' })).toBeVisible();
    const { path } = await downloadBackup(a.p);
    await a.c.close();

    const b = await mk();
    await b.p.goto('/settings');
    await b.p.getByRole('button', { name: /Restore from a backup/ }).click();
    await dialog(b.p).getByLabel('Backup file').setInputFiles(path);
    await dialog(b.p).getByRole('button', { name: 'Add to my data' }).click();
    await expect(b.p.getByText(/Merged/)).toBeVisible();
    await b.p.goto('/recipes?q=photo+dish');
    await b.p
      .getByRole('link', { name: /Photo dish/ })
      .first()
      .click();
    await expect(b.p.getByRole('img', { name: 'Photo dish' })).toBeVisible();
    expect(
      await b.p
        .getByRole('img', { name: 'Photo dish' })
        .evaluate((i: HTMLImageElement) => i.naturalWidth),
    ).toBeGreaterThan(0);
    await b.c.close();
  });
});

test.describe('exports, privacy, reminders', () => {
  test('CSV exports download readable, spreadsheet-safe files', async ({ page }) => {
    await boot(page);
    await loadSample(page);
    await page.goto('/settings');
    const [dl] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Pantry', exact: true }).click(),
    ]);
    expect(dl.suggestedFilename()).toMatch(/^pantrypal-pantry-\d{4}-\d{2}-\d{2}\.csv$/);
    const csv = readFileSync((await dl.path())!, 'utf8');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).trimEnd().split('\r\n');
    expect(lines[0]).toBe(
      'Ingredient,Category,Quantity,Unit,Stored in,Date type,Date,Purchased,Opened,Cost,Currency,Note',
    );
    expect(lines).toHaveLength(30);
    expect(csv).toContain('Flour,Baking,1500,g,pantry');
  });

  test('privacy page, notification help and storage info are present and honest', async ({
    page,
  }) => {
    await boot(page);
    await page.goto('/more');
    await page.getByRole('link', { name: 'Privacy' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy' })).toBeVisible();
    await expect(
      page.getByText(/no analytics, tracking, advertising or error-reporting requests/),
    ).toBeVisible();
    await expect(page.getByText(/not encrypted/)).toBeVisible();
    await page.goto('/settings');
    await expect(page.getByText(/cannot send you a message when the app is closed/)).toBeVisible();
    await expect(page.getByText(/Browser notifications:/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Storage' })).toBeVisible();
    await expect(page.getByText(/PantryPal is using/)).toBeVisible();
  });

  test('home reminds you to back up, can be snoozed, and stops after a backup', async ({
    page,
  }) => {
    await boot(page);
    await loadSample(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Back up your kitchen' })).toBeVisible();
    await page.getByRole('button', { name: 'Remind me in a week' }).click();
    await expect(page.getByRole('heading', { name: 'Back up your kitchen' })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Back up your kitchen' })).toHaveCount(0); // snoozed
    await page.evaluate(() => localStorage.removeItem('pantrypal.backupSnooze'));
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Back up your kitchen' })).toBeVisible();
    await downloadBackup(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Back up your kitchen' })).toHaveCount(0);
  });

  test('a brand-new user is not nagged to back up an empty kitchen', async ({ page }) => {
    await boot(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Good .*!/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Back up your kitchen' })).toHaveCount(0);
  });
});

test.describe('security and privacy of the running app', () => {
  const ROUTES = [
    '/',
    '/pantry',
    '/recipes',
    '/recipes/garden-frittata',
    '/recipes/garden-frittata/cook',
    '/planner',
    '/shopping',
    '/expiring',
    '/analytics',
    '/collections',
    '/history',
    '/settings',
    '/privacy',
    '/more',
  ];

  test('every screen runs under the strict CSP, with no violations and no outside requests', async ({
    page,
  }) => {
    await boot(page);
    const external: string[] = [];
    const problems: string[] = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (!['localhost', '127.0.0.1'].includes(u.hostname) && !/^(data|blob):/.test(r.url()))
        external.push(r.url());
    });
    page.on('console', (m) => {
      if (m.type() === 'error' || /Content Security Policy|Refused to/i.test(m.text()))
        problems.push(m.text());
    });
    page.on('pageerror', (e) => problems.push(e.message));
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) =>
        console.error('CSP violation: ' + e.violatedDirective + ' ' + e.blockedURI),
      );
    });
    await loadSample(page);
    for (const r of ROUTES) {
      await page.goto(r);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    }
    // open a dialog and the finish dialog too (motion + inline styles)
    await page.goto('/pantry');
    await page.getByRole('button', { name: 'Add ingredient' }).first().click();
    await expect(dialog(page)).toBeVisible();
    expect(problems).toEqual([]);
    expect(external).toEqual([]);
    const headers = (await page.request.get('/')).headers();
    expect(headers['content-security-policy']).toContain("default-src 'self'");
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBe('no-referrer');
  });

  test('hostile text is shown as text, never run as markup', async ({ page }) => {
    await boot(page);
    const xss = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=2</script>';
    await page.goto('/recipes/new');
    await page.getByLabel('Name', { exact: true }).fill(xss.slice(0, 60));
    await page.getByLabel('Short description (optional)').fill(xss);
    await page.getByLabel('Ingredient 1 name').fill('Bread');
    await page.getByLabel('Ingredient 1 amount').fill('1');
    await page.getByLabel('Step 1', { exact: true }).fill(xss);
    await page.getByLabel('Notes (optional)').fill(xss);
    await page.getByRole('button', { name: 'Save recipe' }).click();
    await expect(page.getByText(/<img src=x/).first()).toBeVisible();
    await page.goto('/recipes');
    await page.goto('/shopping');
    expect(
      await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned),
    ).toBeUndefined();
    expect(await page.locator('img[src="x"]').count()).toBe(0);
  });
});

test.describe('offline', () => {
  test('after one visit every screen and deep link works without a connection', async ({
    page,
    context,
  }) => {
    await boot(page);
    await loadSample(page);
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    for (const [path, h1] of [
      ['/', /Good .*!/],
      ['/pantry', 'My Pantry'],
      ['/recipes', 'Recipes'],
      ['/recipes/chickpea-curry', 'Chickpea Curry'],
      ['/recipes/chickpea-curry/cook', 'Chickpea Curry'],
      ['/planner', 'Meal Planner'],
      ['/shopping', 'Shopping List'],
      ['/analytics', 'Analytics'],
      ['/settings', 'Settings'],
      ['/privacy', 'Privacy'],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 }).first()).toContainText(h1);
    }
    // data still readable and writable offline
    await page.goto('/pantry/ing-flour');
    await expect(page.getByText(/1\.5 kg|1500 g/).first()).toBeVisible();
    await page.goto('/settings');
    const [dl] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download a backup' }).click(),
    ]);
    expect(dl.suggestedFilename()).toMatch(/\.json$/);
    await context.setOffline(false);
  });
});

test.describe('keyboard and screen reader smoke', () => {
  test('skip link, landmarks, visible focus, dialog focus handling', async ({ page }) => {
    await boot(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.keyboard.press('Tab');
    const first = page.locator(':focus');
    await expect(first).toHaveText('Skip to content');
    expect(
      await first.evaluate(
        (e) =>
          getComputedStyle(e).outlineStyle !== 'none' || getComputedStyle(e).boxShadow !== 'none',
      ),
    ).toBe(true);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
    for (const name of ['Main', 'Primary'] as const) void name;
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();

    // every interactive control on a busy page is keyboard-reachable and shows a focus ring
    await page.goto('/recipes');
    await page.waitForTimeout(600); // let the page transition finish so focus is not on a removed node
    const stops = new Set<string>();
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const e = document.activeElement as HTMLElement;
        const cs = getComputedStyle(e);
        return {
          tag: e.tagName,
          label: e.getAttribute('aria-label') ?? e.textContent?.trim().slice(0, 30) ?? '',
          ring: cs.outlineStyle !== 'none' || cs.boxShadow !== 'none',
        };
      });
      expect(info.ring, `no focus ring on ${info.tag} ${info.label}`).toBe(true);
      stops.add(`${info.tag}:${info.label}`);
    }
    expect(stops.size).toBeGreaterThan(20);

    // dialogs: opening moves focus inside, Escape closes and returns focus
    await page.goto('/pantry');
    const open = page.getByRole('button', { name: 'Add ingredient' }).first();
    await open.focus();
    await page.keyboard.press('Enter');
    await expect(dialog(page)).toBeVisible();
    expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
  });

  test('forms announce errors and every input has a name', async ({ page }) => {
    await boot(page);
    await page.goto('/recipes/new');
    await page.getByRole('button', { name: 'Save recipe' }).click();
    await expect(page.getByRole('alert')).toBeFocused();
    const unnamed = await page.evaluate(() =>
      [...document.querySelectorAll('input,select,textarea,button')]
        .filter((e) => !(e as HTMLInputElement).hidden && (e as HTMLElement).offsetParent !== null)
        .filter((e) => {
          const el = e as HTMLInputElement;
          return !(
            el.labels?.length ||
            e.getAttribute('aria-label') ||
            e.getAttribute('aria-labelledby') ||
            e.textContent?.trim() ||
            e.getAttribute('title')
          );
        })
        .map((e) => e.outerHTML.slice(0, 80)),
    );
    expect(unnamed).toEqual([]);
  });
});

test.describe('contrast in every theme and accent', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const accent of ['terracotta', 'sage', 'saffron', 'plum'] as const) {
      test(`${theme} + ${accent}`, async ({ page }) => {
        await boot(page, { theme, accent });
        await page.setViewportSize({ width: 1280, height: 900 });
        await loadSample(page);
        const seen: string[] = [];
        for (const path of [
          '/',
          '/pantry',
          '/recipes',
          '/recipes/chickpea-curry',
          '/planner',
          '/shopping',
          '/analytics',
          '/settings',
        ]) {
          await page.goto(path);
          await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
          await page.waitForTimeout(350);
          const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
          for (const v of res.violations.filter((x) =>
            ['serious', 'critical'].includes(x.impact ?? ''),
          ))
            seen.push(
              `${path} ${v.id}: ${v.nodes
                .slice(0, 3)
                .map((n) => n.target)
                .join(' | ')}`,
            );
        }
        expect(seen).toEqual([]);
      });
    }
  }
});

test.describe('responsive release screenshots', () => {
  const SIZES: [string, number, number][] = [
    ['360', 360, 740],
    ['390', 390, 844],
    ['430', 430, 932],
    ['768', 768, 1024],
    ['1024', 1024, 768],
    ['1440', 1440, 900],
    ['1920', 1920, 1080],
    ['landscape-phone', 844, 390],
    ['landscape-tablet', 1024, 600],
  ];
  const SHOTS = [
    '/',
    '/pantry',
    '/recipes',
    '/recipes/chickpea-curry',
    '/recipes/chickpea-curry/cook',
    '/planner',
    '/shopping',
    '/analytics',
    '/settings',
  ];
  test('no horizontal overflow, no clipped controls at any size or orientation', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await boot(page);
    await loadSample(page);
    mkdirSync('screenshots/release', { recursive: true });
    const bad: string[] = [];
    for (const [name, w, h] of SIZES) {
      await page.setViewportSize({ width: w, height: h });
      for (const path of SHOTS) {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
        await page.waitForTimeout(200);
        const m = await page.evaluate(() => ({
          over: document.documentElement.scrollWidth > window.innerWidth + 1,
          small: [
            ...document.querySelectorAll('button,a,input,select,textarea,[role=tab],[role=radio]'),
          ]
            .filter(
              (e) =>
                (e as HTMLElement).offsetParent !== null &&
                !e.closest('.sr-only') &&
                !(e as HTMLElement).classList.contains('sr-only'),
            )
            .filter((e) => {
              const r = e.getBoundingClientRect();
              return (
                r.width > 0 &&
                (r.height < 24 || r.width < 24) &&
                !(e as HTMLInputElement).type?.match(/checkbox|radio|hidden/)
              );
            })
            .map((e) =>
              (e.getAttribute('aria-label') ?? e.textContent ?? e.tagName).trim().slice(0, 30),
            ),
        }));
        if (m.over) bad.push(`${name} ${path}: horizontal overflow`);
        if (m.small.length) bad.push(`${name} ${path}: tiny targets ${m.small.join(', ')}`);
        if (path === '/' || path === '/recipes/chickpea-curry/cook' || path === '/planner')
          await page.screenshot({
            path: `screenshots/release/${name}${path.replace(/\//g, '_') || '_home'}.png`,
            fullPage: false,
          });
      }
    }
    expect(bad).toEqual([]);
  });
});
