import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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

test.describe('smart matching', () => {
  test('ranks by pantry, shows tiers, and explains every point', async ({ page }) => {
    await boot(page);
    await loadSample(page);
    await page.goto('/recipes');
    await expect(page.getByRole('combobox', { name: 'Sort by' })).toHaveValue('match');
    await expect(page.getByText('Ready to cook').first()).toBeVisible();
    await expect(page.getByText(/Nearly ready · \d to get/).first()).toBeVisible();
    // the top card is the best score, and the order is explainable on the detail page
    const first = page.getByRole('heading', { level: 3 }).first();
    const name = (await first.textContent())!;
    await first.click();
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Why this match' })).toBeVisible();
    const items = page.getByRole('list', { name: 'Score breakdown' }).getByRole('listitem');
    await expect(items).toHaveCount(5);
    await expect(page.getByText('Pantry coverage')).toBeVisible();
    await expect(page.getByText(/not medical or food-safety advice/)).toBeVisible();
  });

  test('missing recipes list exactly what is missing', async ({ page }) => {
    await boot(page);
    await loadSample(page);
    await page.goto('/recipes/baked-beans-balkan');
    const card = page.getByRole('heading', { name: 'Why this match' }).locator('..').locator('..');
    await expect(card.getByText(/ingredients? missing|Nearly ready/).first()).toBeVisible();
    await expect(card.getByText(/Beans \(dried\): not in your pantry/)).toBeVisible();
  });

  test('allergen and diet filters are informational and can be turned off', async ({ page }) => {
    await boot(page, { allergens: ['eggs'], diets: ['vegetarian'] });
    await page.goto('/recipes');
    await expect(page.getByText(/not medical or safety advice/)).toBeVisible();
    const all = await page.getByText(/ of 33 recipes/).textContent();
    const hidden = Number(all!.match(/^(\d+) of/)![1]);
    expect(hidden).toBeLessThan(33); // egg recipes hidden by default
    await page.getByRole('button', { name: 'Hide recipes with my allergens' }).click();
    await expect(page.getByText('33 of 33 recipes')).toBeVisible();
    await page.goto('/recipes/garden-frittata');
    await page.getByRole('button', { name: 'Shopping list' }).waitFor();
    // no stock → the match card is hidden; add stock first to see allergen note
    await loadSample(page);
    await page.goto('/recipes/garden-frittata');
    await expect(page.getByText(/Contains eggs, which you listed in Settings/)).toBeVisible();
    await page.goto('/recipes');
    await page.getByRole('button', { name: 'Hide recipes with my allergens' }).click();
    await page.getByRole('button', { name: 'Matches my diet tags' }).click();
    await expect(page.getByRole('heading', { name: 'Garden Frittata' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Lemon Garlic Chicken' })).toHaveCount(0);
  });

  test('food past its use-by date is not counted as stock', async ({ page }) => {
    await boot(page);
    await page.goto('/pantry');
    // Milk, use by yesterday
    await page.getByRole('button', { name: 'Add ingredient' }).first().click();
    const d = dialog(page);
    await d.getByLabel('Search ingredients').fill('Milk');
    await d.getByRole('button', { name: /^Milk/ }).first().click();
    await d.getByLabel('Quantity').fill('1');
    await d.getByLabel('Unit').selectOption('l');
    await d.getByRole('radio', { name: 'Use by' }).click();
    const y = new Date();
    y.setDate(y.getDate() - 1);
    await d
      .getByLabel('Date', { exact: true })
      .fill(
        `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`,
      );
    await d.getByRole('button', { name: 'Add to storage' }).click();
    await expect(d).toBeHidden();
    await page.goto('/recipes/banana-pancakes');
    await expect(page.getByText(/Some stock past its use-by date was not counted/)).toBeVisible();
    await expect(
      page.getByRole('listitem').filter({ hasText: 'Milk' }).getByText('Not in pantry'),
    ).toBeVisible();
  });
});

test.describe('analytics', () => {
  test('empty state is honest', async ({ page }) => {
    await boot(page);
    await page.goto('/analytics');
    await expect(page.getByText('No data yet')).toBeVisible();
  });

  test('charts come from real records and reconcile', async ({ page }) => {
    await boot(page);
    await loadSample(page);
    await page.goto('/analytics');
    await expect(page.getByRole('heading', { level: 1, name: 'Analytics' })).toBeVisible();
    // 29 sample lots; pasta appears twice → 28 distinct ingredients
    await expect(
      page.getByText('Ingredients in stock').locator('..').getByText('28'),
    ).toBeVisible();
    await expect(
      page.getByText('Lots', { exact: true }).locator('..').getByText('29'),
    ).toBeVisible();
    const zones = page.getByRole('list', { name: 'Lots by storage place' });
    await expect(zones.getByRole('listitem')).toHaveCount(3);
    const sum = async (loc: ReturnType<Page['locator']>) =>
      (await loc.allInnerTexts()).reduce(
        (s, t) => s + Number(t.split('\n').at(-1)!.replace(/\D/g, '')),
        0,
      );
    expect(await sum(zones.getByRole('listitem').locator('span:last-child'))).toBe(29);
    const dates = page.getByRole('list', { name: 'Lots by date window' });
    expect(await sum(dates.getByRole('listitem').locator('span:last-child'))).toBe(29);
    // filters
    await page.getByRole('combobox', { name: 'Storage place' }).selectOption('fridge');
    await expect(
      page.getByText('Lots', { exact: true }).locator('..').getByText('8'),
    ).toBeVisible();
    await page.getByRole('combobox', { name: 'Ingredient category' }).selectOption('Dairy & Eggs');
    await expect(
      page
        .getByText('Lots', { exact: true })
        .locator('..')
        .getByText(/^[1-9]$/),
    ).toBeVisible();
    await expect(page.getByText(/How this is counted/).first()).toBeVisible();
    await expect(
      page.getByText('Finish a recipe in Cooking Mode and it will appear here.'),
    ).toBeVisible();
  });

  test('cooking shows up in the activity charts', async ({ page }) => {
    await boot(page, { motion: 'low' });
    await loadSample(page);
    await page.goto('/recipes/spaghetti-aglio-olio/cook');
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Finish cooking' }).click();
    await dialog(page).getByRole('button', { name: 'Confirm and update pantry' }).click();
    await expect(page.getByText(/Pantry updated for/)).toBeVisible();
    await page.goto('/analytics');
    await expect(
      page.getByText('Meals cooked').locator('..').getByText('1', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('list', { name: 'Most used ingredients' }).getByText('Pasta'),
    ).toBeVisible();
    await page.getByText('View as table').click();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('row').last().getByRole('cell').last()).toHaveText('1');
  });

  test('axe: analytics and recipes with stock', async ({ page }) => {
    await boot(page);
    await loadSample(page);
    for (const path of ['/analytics', '/recipes', '/recipes/chickpea-curry']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.waitForTimeout(500);
      const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      const bad = res.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));
      expect(
        bad.map((v) => `${path} ${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`),
      ).toEqual([]);
    }
  });
});

test.describe('motion', () => {
  test('cooking finish plays a flourish (Cinematic holds it longest) and returns to the recipe', async ({
    page,
  }) => {
    await boot(page, { motion: 'cinematic' });
    await page.goto('/recipes/garden-salad/cook');
    for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Finish cooking' }).click();
    await dialog(page).getByRole('button', { name: 'Finish without changing pantry' }).click();
    await expect(page.getByText('Enjoy your meal')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Garden Salad' })).toBeVisible({
      timeout: 5000,
    });
  });

  test('Low motion and the system reduce-motion setting skip the flourish', async ({ browser }) => {
    for (const mode of ['low', 'reduced'] as const) {
      const ctx = await browser.newContext(mode === 'reduced' ? { reducedMotion: 'reduce' } : {});
      const page = await ctx.newPage();
      await boot(page, mode === 'low' ? { motion: 'low' } : {});
      await page.goto('/recipes/garden-salad/cook');
      for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Next' }).click();
      await page.getByRole('button', { name: 'Finish cooking' }).click();
      await dialog(page).getByRole('button', { name: 'Finish without changing pantry' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Garden Salad' })).toBeVisible({
        timeout: 1500,
      });
      await expect(page.getByText('Enjoy your meal')).toHaveCount(0);
      await ctx.close();
    }
  });

  test('Low motion removes hover and press transitions', async ({ page }) => {
    await boot(page, { motion: 'low' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/pantry');
    const btn = page.getByRole('button', { name: 'Add ingredient' }).first();
    expect(await btn.evaluate((e) => getComputedStyle(e).transitionDuration)).toMatch(
      /^0s(, 0s)*$/,
    );
  });
});

test.describe('performance hygiene', () => {
  test('analytics and cooking load as separate lazy chunks, not on first paint', async ({
    page,
  }) => {
    await boot(page);
    const loaded: string[] = [];
    page.on('response', (r) => {
      if (r.url().endsWith('.js')) loaded.push(r.url().split('/').pop()!);
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Good .*!/ })).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(loaded.some((n) => /^AnalyticsPage-/.test(n))).toBe(false);
    expect(loaded.some((n) => /^CookingPage-/.test(n))).toBe(false);
    await page.goto('/analytics');
    await expect(page.getByRole('heading', { level: 1, name: 'Analytics' })).toBeVisible();
    expect(loaded.some((n) => /^AnalyticsPage-/.test(n))).toBe(true);
  });
});
