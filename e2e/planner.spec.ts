import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PREFS_KEY = 'pantrypal.prefs.v1';

async function boot(page: Page) {
  await page.addInitScript(
    ([k, v]) => {
      if (!localStorage.getItem(k as string)) localStorage.setItem(k as string, JSON.stringify(v));
    },
    [PREFS_KEY, { onboarded: true, name: 'Bojan' }],
  );
}
async function loadSample(page: Page) {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Load sample pantry' }).click();
  await expect(page.getByText(/Loaded 29 sample items/)).toBeVisible();
}
const dialog = (page: Page) => page.getByRole('dialog');

async function plan(page: Page, search: string, slotButton = 'Add to Dinner on') {
  // Earlier days are skipped by shopping generation, so plan on today's weekday by default.
  if (slotButton === 'Add to Dinner on')
    slotButton += ` ${new Date().toLocaleDateString('en', { weekday: 'long' })}`;
  await page
    .getByRole('button', { name: new RegExp(slotButton) })
    .first()
    .click();
  const d = dialog(page);
  await d.getByLabel('Search recipes to plan').fill(search);
  await d
    .getByRole('button', { name: new RegExp(search, 'i') })
    .first()
    .click();
  await d.getByRole('button', { name: 'Add to plan' }).click();
  await expect(d).toBeHidden();
}

test.describe('meal planner', () => {
  test('plans, edits, moves, duplicates and removes meals', async ({ page }) => {
    await boot(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/planner');
    await plan(page, 'frittata');
    const entry = page.getByRole('article').filter({ hasText: 'Garden Frittata' });
    await expect(entry).toBeVisible();
    await expect(entry.getByText('3 servings')).toBeVisible();

    // edit servings + move with buttons (keyboard-accessible alternative to drag)
    await entry.getByRole('button', { name: /Edit or move/ }).click();
    await dialog(page).getByLabel('Servings').fill('5');
    await dialog(page).getByRole('button', { name: 'Next day' }).click();
    await expect(entry.getByText('5 servings')).toHaveCount(0); // moved: reappears in another day
    const moved = page.getByRole('article').filter({ hasText: 'Garden Frittata' });
    await expect(moved).toHaveCount(1);

    // duplicate to lunch on the same date
    await moved.getByRole('button', { name: /Edit or move/ }).click();
    await dialog(page).getByLabel('Meal', { exact: true }).selectOption('lunch');
    await dialog(page)
      .getByRole('button', { name: /Duplicate to date and meal/ })
      .click();
    await expect(page.getByRole('article').filter({ hasText: 'Garden Frittata' })).toHaveCount(2);

    // note entry
    await page
      .getByRole('button', { name: /Add to Snack on/ })
      .first()
      .click();
    await dialog(page)
      .getByRole('radio', { name: /A note/ })
      .click();
    await dialog(page).getByLabel('Note').fill('Leftovers');
    await dialog(page).getByRole('button', { name: 'Add to plan' }).click();
    await expect(page.getByRole('article').filter({ hasText: 'Leftovers' })).toBeVisible();

    // remove
    await page
      .getByRole('article')
      .filter({ hasText: 'Leftovers' })
      .getByRole('button', { name: /Edit or move/ })
      .click();
    await dialog(page).getByRole('button', { name: 'Remove', exact: true }).click();
    await dialog(page).getByRole('button', { name: 'Yes, remove' }).click();
    await expect(page.getByRole('article').filter({ hasText: 'Leftovers' })).toHaveCount(0);

    // persists
    await page.reload();
    await expect(page.getByRole('article').filter({ hasText: 'Garden Frittata' })).toHaveCount(2);
  });

  test('drag and drop moves a meal to another day', async ({ page }) => {
    await boot(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/planner?date=2031-03-05');
    await page.getByRole('button', { name: /Add to Dinner on Wednesday/ }).click();
    await dialog(page).getByLabel('Search recipes to plan').fill('salad');
    await dialog(page)
      .getByRole('button', { name: /Garden Salad/ })
      .click();
    await dialog(page).getByRole('button', { name: 'Add to plan' }).click();
    const from = page.getByRole('region', {
      name: /Wednesday, 5 March, Dinner|Wednesday, March 5, Dinner/,
    });
    await expect(from.getByRole('article')).toHaveCount(1);
    const to = page.locator('section[aria-label*="Friday"][aria-label$="Lunch"]');
    await from.getByRole('article').dragTo(to);
    await expect(to.getByRole('article')).toHaveCount(1);
    await expect(from.getByRole('article')).toHaveCount(0);
  });

  test('navigates weeks', async ({ page }) => {
    await boot(page);
    await page.goto('/planner?date=2031-03-05');
    await expect(
      page.getByRole('heading', { level: 2, name: /Mar 3 – Mar 9, 2031/ }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Next week' }).click();
    await expect(
      page.getByRole('heading', { level: 2, name: /Mar 10 – Mar 16, 2031/ }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'This week', exact: true }).click();
    await expect(page.getByRole('heading', { level: 2, name: /Mar 10/ })).toHaveCount(0);
  });

  test('cook link carries the planned entry', async ({ page }) => {
    await boot(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/planner');
    await plan(page, 'oats');
    await page.getByRole('link', { name: /^Cook Overnight Oats/ }).click();
    await expect(page).toHaveURL(/\/recipes\/overnight-oats\/cook\?servings=2&plan=/);
  });
});

test.describe('shopping', () => {
  test('plan → generate → manage → buy → pantry', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await boot(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loadSample(page);

    await page.goto('/planner');
    await plan(page, 'Baked Beans'); // dried beans, paprika, tomato paste, pepper...
    await plan(page, 'Garden Frittata'); // eggs/onion in sample pantry, but zucchini/feta are not
    await page.getByRole('button', { name: 'Shopping list for this week' }).click();
    const d = dialog(page);
    await d.getByLabel('New list name').fill('Weekly');
    await expect(d.getByRole('list', { name: 'Items to add' })).toBeVisible();
    // transparent maths
    await expect(
      d
        .getByRole('list', { name: 'Items to add' })
        .getByText(/Need .*buy/)
        .first(),
    ).toBeVisible();
    const zucchini = d.getByRole('listitem').filter({ hasText: 'Zucchini' });
    await expect(zucchini).toContainText('Need 1 pcs, buy 1 pcs');
    await zucchini.getByRole('checkbox').uncheck();
    await d.getByRole('button', { name: /^Add \d+ items?$/ }).click();
    await expect(page.getByText(/Added \d+ items? on your list/)).toBeVisible();

    await page.goto('/shopping');
    await expect(page.getByRole('tab', { name: 'Weekly' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('heading', { name: 'Dairy & Eggs' })).toBeVisible(); // feta
    await expect(page.getByText('Zucchini')).toHaveCount(0); // we unticked it
    await expect(page.getByText('Beans (dried)')).toBeVisible();

    // generating again adds nothing: the list already covers the gap
    await page.goto('/planner');
    await page.getByRole('button', { name: 'Shopping list for this week' }).click();
    await expect(
      dialog(page)
        .getByText(/Zucchini/)
        .first(),
    ).toBeVisible(); // not on list (skipped) → offered again
    await dialog(page).getByRole('button', { name: 'Cancel' }).click();

    // manual items, prices, budget, totals
    await page.goto('/shopping');
    await page.getByLabel('Item name').fill('Flour');
    await page.getByLabel('Amount (optional)').fill('1');
    await page.getByLabel('Unit', { exact: true }).selectOption('kg');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByText('1 kg')).toBeVisible();
    await page.getByRole('button', { name: 'Edit Flour' }).click();
    await dialog(page)
      .getByLabel(/Price per kg/)
      .fill('1.5');
    await dialog(page).getByRole('button', { name: 'Save' }).click();
    await page.getByRole('button', { name: 'Budget and currency' }).click();
    await dialog(page).getByLabel('Currency').selectOption('EUR');
    await dialog(page).getByLabel('Budget (optional)').fill('1');
    await dialog(page).getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/Estimated total from the prices you entered/)).toContainText(
      '€1.50',
    );
    await expect(page.getByText(/€0.50 over budget of €1.00/)).toBeVisible();

    // copy as text
    await page.getByRole('button', { name: 'Copy as text' }).click();
    await expect(page.getByText('List copied.')).toBeVisible();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toContain('Weekly');
    expect(clip).toContain('[ ] 1 kg Flour');

    // ticking does NOT touch the pantry
    await page.getByRole('checkbox', { name: /Flour/ }).click();
    await expect(page.getByRole('checkbox', { name: /Flour/ })).toBeChecked();
    await page.goto('/pantry/ing-flour');
    await expect(page.getByText(/1\.5 kg|1500 g/).first()).toBeVisible(); // only the sample stock

    // confirm purchase into the pantry
    await page.goto('/shopping');
    await page.getByRole('button', { name: /Add 1 ticked to pantry/ }).click();
    const s = dialog(page);
    await s.getByLabel('Flour: amount bought').fill('900');
    await s.getByLabel('Flour: unit').selectOption('g');
    await s.getByLabel('Flour: store in').selectOption('pantry');
    await s.getByRole('button', { name: /^Add 1 to pantry$/ }).click();
    await expect(page.getByText('Added 1 purchase to your pantry')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Added to your pantry' })).toBeVisible();
    await page.goto('/pantry/ing-flour');
    await expect(page.getByText(/2\.4 kg|2400 g/).first()).toBeVisible();
  });

  test('add missing ingredients from a recipe page', async ({ page }) => {
    await boot(page);
    await page.goto('/recipes/chickpea-curry');
    await page.getByRole('button', { name: 'Shopping list' }).click();
    const d = dialog(page);
    await d.getByLabel('New list name').fill('Curry night');
    await d.getByRole('button', { name: /^Add \d+ items$/ }).click();
    await expect(page.getByText(/Added \d+ items? on your list/)).toBeVisible();
    await page.goto('/shopping');
    await expect(page.getByText('Canned chickpeas')).toBeVisible();
    await expect(page.getByText(/^2 cans/)).toBeVisible();
  });

  test('lists can be created, switched, renamed and deleted', async ({ page }) => {
    await boot(page);
    await page.goto('/shopping');
    await page.getByRole('button', { name: 'Create a list' }).click();
    await dialog(page).getByLabel('List name').fill('Market');
    await dialog(page).getByRole('button', { name: 'Save' }).click();
    await page.getByRole('button', { name: 'New list' }).click();
    await dialog(page).getByLabel('List name').fill('market');
    await dialog(page).getByRole('button', { name: 'Save' }).click();
    await expect(dialog(page).getByText(/already exists/)).toBeVisible();
    await dialog(page).getByLabel('List name').fill('Butcher');
    await dialog(page).getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('tab', { name: 'Butcher' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.getByRole('tab', { name: 'Market' }).click();
    await page.getByRole('button', { name: 'Rename' }).click();
    await dialog(page).getByLabel('List name').fill('Greengrocer');
    await dialog(page).getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('tab', { name: 'Greengrocer' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete list' }).click();
    await dialog(page).getByRole('button', { name: 'Delete list' }).click();
    await expect(page.getByRole('tab', { name: 'Greengrocer' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Butcher' })).toBeVisible();
  });
});

test.describe('phase 4 accessibility and layout', () => {
  for (const [name, path] of [
    ['planner', '/planner'],
    ['shopping empty', '/shopping'],
  ] as const) {
    test(`${name} has no serious axe violations`, async ({ page }) => {
      await boot(page);
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.waitForTimeout(400);
      const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      const bad = res.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));
      expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([]);
    });
  }

  test('a populated list has no serious axe violations and fits a phone', async ({ page }) => {
    await boot(page);
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/shopping');
    await page.getByRole('button', { name: 'Create a list' }).click();
    await dialog(page).getByLabel('List name').fill('Weekly');
    await dialog(page).getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/list=/);
    await page.getByLabel('Item name').fill('Milk');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByRole('checkbox', { name: /Milk/ })).toBeVisible();
    await page.waitForTimeout(400);
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      res.violations
        .filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))
        .map((v) => v.id),
    ).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
});
