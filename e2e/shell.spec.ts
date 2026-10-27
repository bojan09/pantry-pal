import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

const WIDTHS = [360, 390, 430, 768, 1024, 1440];
const ROUTES = [
  '/',
  '/pantry',
  '/recipes',
  '/planner',
  '/shopping',
  '/expiring',
  '/analytics',
  '/collections',
  '/settings',
  '/more',
  '/nope',
];
const PREFS_KEY = 'pantrypal.prefs.v1';

async function seedOnboarded(page: Page, extra: Record<string, unknown> = {}) {
  await page.addInitScript(
    ([k, v]) => {
      if (!localStorage.getItem(k as string)) localStorage.setItem(k as string, JSON.stringify(v));
    },
    [PREFS_KEY, { onboarded: true, name: 'Bojan', ...extra }],
  );
}

const noHScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test.describe('responsive: no horizontal overflow', () => {
  for (const width of WIDTHS) {
    test(`all routes at ${width}px`, async ({ page }) => {
      await seedOnboarded(page);
      await page.setViewportSize({ width, height: 900 });
      for (const route of ROUTES) {
        await page.goto(route);
        await expect(page.locator('h1').first()).toBeVisible();
        expect(await noHScroll(page), `${route} @${width}`).toBe(true);
      }
    });
  }

  test('landscape phone', async ({ page }) => {
    await seedOnboarded(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/');
    expect(await noHScroll(page)).toBe(true);
  });
});

test.describe('onboarding', () => {
  test('first run shows onboarding, saves choices, then the shell', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Welcome to your kitchen' })).toBeVisible();
    await page.getByLabel('What should we call you?').fill('Ana');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('radio', { name: 'Imperial' }).click();
    await page.getByLabel('Currency').selectOption('EUR');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Vegetarian' }).click();
    await page.getByRole('button', { name: 'Start cooking' }).click();
    await expect(
      page.getByRole('heading', { name: /Good (morning|afternoon|evening), Ana!/ }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: /Good .*, Ana!/ })).toBeVisible();
    const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), PREFS_KEY);
    expect(stored).toMatchObject({
      onboarded: true,
      units: 'imperial',
      currency: 'EUR',
      diets: ['vegetarian'],
    });
  });

  test('can be skipped', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Skip setup' }).click();
    await expect(page.getByRole('heading', { name: /Good .*!/ })).toBeVisible();
  });
});

test.describe('navigation', () => {
  test('desktop sidebar reaches every section', async ({ page }) => {
    await seedOnboarded(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const sidebar = page.getByRole('navigation', { name: 'Main' });
    for (const [name, h1] of [
      ['My Pantry', 'My Pantry'],
      ['Recipes', 'Recipes'],
      ['Meal Planner', 'Meal Planner'],
      ['Shopping List', 'Shopping List'],
      ['Expiring Soon', 'Expiring Soon'],
      ['Analytics', 'Analytics'],
      ['Collections', 'Collections'],
      ['Settings', 'Settings'],
    ]) {
      await sidebar.getByRole('link', { name }).click();
      await expect(page.getByRole('heading', { level: 1, name: h1 })).toBeVisible();
      await expect(sidebar.getByRole('link', { name })).toHaveAttribute('aria-current', 'page');
    }
  });

  test('mobile bottom nav + More + back controls', async ({ page }) => {
    await seedOnboarded(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Primary' });
    await nav.getByRole('link', { name: 'Pantry' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'My Pantry' })).toBeVisible();
    await nav.getByRole('link', { name: 'More' }).click();
    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    await page.getByRole('link', { name: 'Back', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'More' })).toBeVisible();
    await page.goto('/recipes/does-not-exist');
    await page.getByRole('link', { name: 'Back', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Recipes' })).toBeVisible();
  });

  test('every touch target in the bottom nav is at least 44px', async ({ page }) => {
    await seedOnboarded(page);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/');
    for (const link of await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link')
      .all()) {
      const box = (await link.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('preferences', () => {
  test('theme and accent apply and persist across reloads', async ({ page }) => {
    await seedOnboarded(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/settings');
    await page.getByRole('radio', { name: 'Dark' }).click();
    await page.getByRole('radio', { name: 'Sage' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'sage');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'sage');
  });

  test('custom background photo is stored locally and applied', async ({ page }) => {
    await seedOnboarded(page);
    await page.goto('/settings');
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    await page
      .getByLabel('Custom background photo')
      .setInputFiles({ name: 'bg.png', mimeType: 'image/png', buffer: png });
    await expect(page.getByRole('radio', { name: 'Custom' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.locator('img[src^="blob:"]')).toHaveCount(1);
    await page.reload();
    await expect(page.locator('img[src^="blob:"]')).toHaveCount(1);
  });

  test('rejects a non-image file as a background', async ({ page }) => {
    await seedOnboarded(page);
    await page.goto('/settings');
    await page
      .getByLabel('Custom background photo')
      .setInputFiles({ name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') });
    await expect(page.getByRole('alert')).toContainText('JPEG, PNG or WebP');
  });
});

test.describe('offline + PWA', () => {
  test('manifest is valid and service worker serves the shell offline after first load', async ({
    page,
    context,
  }) => {
    await seedOnboarded(page);
    await page.goto('/');
    const manifest = await (await page.request.get('/manifest.webmanifest')).json();
    expect(manifest).toMatchObject({ short_name: 'PantryPal', display: 'standalone' });
    expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(
      expect.arrayContaining(['192x192', '512x512']),
    );

    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload(); // let the SW take control
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

    await context.setOffline(true);
    await page.goto('/pantry'); // deep link, must come from precache via navigateFallback
    await expect(page.getByRole('heading', { level: 1, name: 'My Pantry' })).toBeVisible();
    await expect(page.getByText(/You're offline/)).toBeVisible();
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: /Good .*, Bojan!/ })).toBeVisible();
    await context.setOffline(false);
  });
});

test.describe('accessibility (axe, WCAG A/AA)', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`no violations on every route — ${theme}`, async ({ page }) => {
      await seedOnboarded(page, { theme });
      await page.setViewportSize({ width: 1440, height: 900 });
      for (const route of ROUTES) {
        await page.goto(route);
        await expect(page.locator('h1').first()).toBeVisible();
        await page.waitForTimeout(300); // page transition
        const res = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(
          res.violations.map(
            (v) => `${route}: ${v.id} ${v.nodes.map((n) => n.target).join(' | ')}`,
          ),
        ).toEqual([]);
      }
    });
  }

  test('onboarding and mobile layout have no violations', async ({ page }) => {
    await page.goto('/');
    let res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(res.violations.map((v) => v.id)).toEqual([]);
    await page.getByRole('button', { name: 'Skip setup' }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(res.violations.map((v) => v.id)).toEqual([]);
  });
});

test('screenshots for design review', async ({ page }) => {
  mkdirSync('screenshots', { recursive: true });
  await seedOnboarded(page);
  for (const w of [360, 390, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width: w, height: w >= 1024 ? 1000 : 860 });
    await page.goto('/');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `screenshots/home-${w}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const r of ['pantry', 'settings', 'more']) {
    await page.goto('/' + r);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `screenshots/${r}-390.png`, fullPage: true });
  }
});
