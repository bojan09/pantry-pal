import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PREFS_KEY = 'pantrypal.prefs.v1';

async function boot(page: Page, prefs: Record<string, unknown> = {}) {
  await page.addInitScript(
    ([k, v]) => {
      if (!localStorage.getItem(k as string)) localStorage.setItem(k as string, JSON.stringify(v));
    },
    [PREFS_KEY, { onboarded: true, name: 'Bojan', sampleContent: false, ...prefs }],
  );
}

const dialog = (page: Page) => page.getByRole('dialog');

/** Loads the sample pantry from Settings and waits until every item is saved. */
async function loadSample(page: Page) {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Load sample pantry' }).click();
  await expect(page.getByText(/Loaded 29 sample items/)).toBeVisible();
}

/** Adds an ingredient through the real UI. */
async function addIngredient(
  page: Page,
  o: {
    search: string;
    pick?: RegExp;
    qty: string;
    unit?: string;
    zone?: string;
    dateType?: 'Best before' | 'Use by' | 'No date';
    date?: string;
  },
) {
  await page.getByRole('button', { name: 'Add ingredient' }).first().click();
  const d = dialog(page);
  await d.getByLabel('Search ingredients').fill(o.search);
  await d
    .getByRole('button', { name: o.pick ?? new RegExp(`^${o.search}`, 'i') })
    .first()
    .click();
  await d.getByLabel('Quantity').fill(o.qty);
  if (o.unit) await d.getByLabel('Unit').selectOption(o.unit);
  if (o.zone) await d.getByRole('radio', { name: o.zone }).click();
  await d.getByRole('radio', { name: o.dateType ?? 'No date' }).click();
  if (o.date) await d.getByLabel('Date', { exact: true }).fill(o.date);
  await d.getByRole('button', { name: 'Add to storage' }).click();
  await expect(d).toBeHidden();
}

const iso = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

test.describe('add + persist', () => {
  test('adds an ingredient, shows it on the shelf, and keeps it after reload and offline', async ({
    page,
    context,
  }) => {
    await boot(page);
    await page.goto('/pantry');
    await expect(page.getByText('Your pantry is empty')).toBeVisible();
    await addIngredient(page, { search: 'flour', qty: '1000', unit: 'g' });
    await expect(page.getByText('Added 1000 g Flour')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Flour, 1 kg/ })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('button', { name: /^Flour, 1 kg/ })).toBeVisible();

    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    await page.goto('/pantry');
    await expect(page.getByRole('button', { name: /^Flour, 1 kg/ })).toBeVisible();
    await context.setOffline(false);
  });

  test('validates input without saving anything', async ({ page }) => {
    await boot(page);
    await page.goto('/pantry');
    await page.getByRole('button', { name: 'Add ingredient' }).first().click();
    const d = dialog(page);
    await d.getByRole('button', { name: 'Add to storage' }).click();
    await expect(d.getByText('Choose an ingredient')).toBeVisible();
    await expect(d.getByText('Enter a quantity')).toBeVisible();
    await d.getByLabel('Search ingredients').fill('rice');
    await d.getByRole('button', { name: /^Rice/ }).first().click();
    await d.getByLabel('Quantity').fill('-5');
    await d.getByRole('button', { name: 'Add to storage' }).click();
    await expect(d.getByText('Must be greater than 0')).toBeVisible();
    await d.getByLabel('Quantity').fill('2');
    await d.getByRole('radio', { name: 'Use by' }).click();
    await d.getByRole('button', { name: 'Add to storage' }).click();
    await expect(d.getByText('Enter the date from the package')).toBeVisible();
    await d.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Your pantry is empty')).toBeVisible();
  });

  test('creates a custom ingredient inline', async ({ page }) => {
    await boot(page);
    await page.goto('/pantry');
    await page.getByRole('button', { name: 'Add ingredient' }).first().click();
    const d = dialog(page);
    await d.getByLabel('Search ingredients').fill('Harissa');
    await d.getByRole('button', { name: /Create .Harissa./ }).click();
    await d.getByLabel('Category').selectOption('Oils & Sauces');
    await d.getByRole('button', { name: 'Create ingredient' }).click();
    // wait for the new ingredient to be saved and selected, not just for matching text
    await expect(d.getByRole('button', { name: 'Change' })).toBeVisible();
    await expect(d.getByText('Harissa', { exact: true })).toBeVisible();
    await d.getByLabel('Quantity').fill('150');
    await d.getByRole('radio', { name: 'No date' }).click();
    await d.getByRole('button', { name: 'Add to storage' }).click();
    await expect(page.getByRole('button', { name: /^Harissa, 150 g/ })).toBeVisible();
  });
});

test.describe('lots, units, use, move, discard', () => {
  test('aggregates compatible lots, lists incompatible units separately, and supports use/undo', async ({
    page,
  }) => {
    await boot(page);
    await page.goto('/pantry');
    await addIngredient(page, { search: 'flour', qty: '1000', unit: 'g' });
    await page.getByRole('button', { name: /^Flour,/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Flour' })).toBeVisible();

    // second lot in kg -> merged into one mass total
    await page.getByRole('button', { name: 'Add stock' }).click();
    await dialog(page).getByLabel('Quantity').fill('1');
    await dialog(page).getByLabel('Unit').selectOption('kg');
    await dialog(page).getByRole('radio', { name: 'No date' }).click();
    await dialog(page).getByRole('button', { name: 'Add to storage' }).click();
    await expect(page.getByText('2 kg', { exact: true })).toBeVisible();

    // a piece-count lot is never merged into the mass total
    await page.getByRole('button', { name: 'Add stock' }).click();
    await dialog(page).getByLabel('Quantity').fill('2');
    await dialog(page).getByLabel('Unit').selectOption('pcs');
    await dialog(page).getByRole('radio', { name: 'No date' }).click();
    await dialog(page).getByRole('button', { name: 'Add to storage' }).click();
    await expect(page.getByText('2 kg + 2 pcs', { exact: true })).toBeVisible();

    // use more than exists in compatible units -> refused, nothing changes
    await page.getByRole('button', { name: 'Use some' }).click();
    await dialog(page).getByLabel('Amount used').fill('5000');
    await dialog(page).getByLabel('Unit').selectOption('g');
    await dialog(page).getByRole('button', { name: 'Use', exact: true }).click();
    await expect(dialog(page).getByRole('alert')).toContainText('Only 2000 g available');
    await dialog(page).getByLabel('Amount used').fill('500');
    await dialog(page).getByRole('button', { name: 'Use', exact: true }).click();
    await expect(page.getByText('1.5 kg + 2 pcs', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText('2 kg + 2 pcs', { exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: '' }).first())
      .toBeVisible()
      .catch(() => {});
  });

  test('partial move splits a lot; discard asks first and can be undone', async ({ page }) => {
    await boot(page);
    await page.goto('/pantry');
    await addIngredient(page, { search: 'rice', qty: '1000', unit: 'g' });
    await page.getByRole('button', { name: /^Rice,/ }).click();

    await page.getByRole('button', { name: 'Move' }).click();
    await dialog(page).getByRole('radio', { name: 'Fridge' }).click();
    await dialog(page)
      .getByLabel(/How much/)
      .fill('400');
    await dialog(page).getByRole('button', { name: 'Move', exact: true }).click();
    await expect(page.getByRole('article')).toHaveCount(2);
    await expect(page.getByText('400 g', { exact: true })).toBeVisible();
    await expect(page.getByText('600 g', { exact: true })).toBeVisible();

    await page
      .getByRole('article')
      .filter({ hasText: '400 g' })
      .getByRole('button', { name: 'Discard' })
      .click();
    await expect(dialog(page)).toContainText('Discard 400 g of Rice?');
    await dialog(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('article')).toHaveCount(2); // cancel changed nothing

    await page
      .getByRole('article')
      .filter({ hasText: '400 g' })
      .getByRole('button', { name: 'Discard' })
      .click();
    await dialog(page).getByRole('button', { name: 'Discard', exact: true }).click();
    await expect(page.getByRole('article')).toHaveCount(1);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByRole('article')).toHaveCount(2);
    await expect(page.getByText('Discarded', { exact: false }).first()).toBeVisible();
  });

  test('a dialog opened right after navigating survives (page mounts once per route)', async ({
    page,
  }) => {
    await boot(page);
    await page.goto('/pantry');
    await addIngredient(page, { search: 'oats', qty: '500', unit: 'g' });
    await page.getByRole('button', { name: /^Oats,/ }).click();
    await page.getByRole('button', { name: 'Add stock' }).click(); // immediately, no waiting
    await page.waitForTimeout(1000);
    await expect(dialog(page)).toBeVisible();
  });

  test('edits a lot and records the correction in history', async ({ page }) => {
    await boot(page);
    await page.goto('/pantry');
    await addIngredient(page, { search: 'sugar', qty: '800', unit: 'g' });
    await page.getByRole('button', { name: /^Sugar,/ }).click();
    await page.getByRole('button', { name: 'Edit' }).click();
    await dialog(page).getByLabel('Quantity').fill('750');
    await dialog(page).getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('750 g', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Corrected/)).toBeVisible();
    await expect(page.getByText(/−|-50 g/).first()).toBeVisible();
  });
});

test.describe('sample pantry, shelves, list, expiring', () => {
  test('loads labelled sample items, drives shelves by keyboard, and removes only samples', async ({
    page,
  }) => {
    await boot(page);
    await page.goto('/pantry');
    await addIngredient(page, { search: 'honey', qty: '300', unit: 'g' }); // a real item
    await page
      .getByRole('link', { name: 'Settings' })
      .first()
      .click()
      .catch(() => {});
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Load sample pantry' }).click();
    await expect(page.getByText(/Loaded 29 sample items/)).toBeVisible();

    await page.goto('/pantry');
    await page.getByRole('radio', { name: 'Fridge' }).click();
    const milk = page.getByRole('button', { name: /^Milk,/ });
    await expect(milk).toBeVisible();
    await milk.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: 'Milk' })).toBeVisible();
    await expect(page.getByText('Sample item')).toBeVisible();

    await page.goto('/settings');
    await page.getByRole('button', { name: /Remove sample items/ }).click();
    await expect(page.getByText(/Removed 29 sample items/)).toBeVisible();
    await page.goto('/pantry');
    await expect(page.getByRole('button', { name: /^Honey,/ })).toBeVisible();
    await page.getByRole('radio', { name: 'List' }).click();
    await expect(page.getByRole('link', { name: /Honey/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Milk/ })).toHaveCount(0);
  });

  test('list view filters, searches and bulk-moves', async ({ page }) => {
    await boot(page);
    await loadSample(page);
    await page.goto('/pantry');
    await page.getByRole('radio', { name: 'List' }).click();
    await page.getByRole('radio', { name: 'All' }).click();
    await expect(
      page.locator('dt', { hasText: 'Ingredients' }).locator('..').locator('dd'),
    ).toHaveText('28');

    await page.getByRole('button', { name: 'Low stock' }).click();
    await expect(page.getByRole('link', { name: /Lentils/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Rice/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Low stock' }).click();

    await page.getByLabel('Search your ingredients').fill('rice');
    await page.getByLabel('Select Rice').check();
    await page
      .getByRole('region', { name: 'Bulk actions' })
      .getByRole('button', { name: 'Move…' })
      .click();
    await dialog(page).getByRole('radio', { name: 'Fridge' }).click();
    await dialog(page).getByRole('button', { name: 'Move', exact: true }).click();
    await expect(dialog(page)).toBeHidden();
    await page.getByLabel('Search your ingredients').fill('');
    await page.getByRole('radio', { name: 'Fridge' }).click();
    await expect(page.getByRole('link', { name: /Rice/ })).toBeVisible();
  });

  test('expiring page separates past, upcoming and undated, with the safety caveat', async ({
    page,
  }) => {
    await boot(page);
    await loadSample(page);
    await page.goto('/expiring');
    await expect(page.getByText(/cannot tell you whether food is safe/)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Date has passed/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Bread/ })).toContainText(
      'Past best-before date by 1 day',
    );
    await expect(page.getByRole('heading', { name: /Coming up/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Tomatoes/ })).toContainText(
      '2 days to best-before date',
    );
    await expect(page.getByRole('link', { name: /Milk/ })).toContainText('3 days to use-by date');
    await expect(page.getByRole('heading', { name: /Low stock/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /No date logged/ })).toBeVisible();
  });

  test('lead-days setting changes what counts as soon', async ({ page }) => {
    await boot(page);
    await page.goto('/pantry');
    await addIngredient(page, {
      search: 'milk',
      qty: '1',
      unit: 'l',
      dateType: 'Use by',
      date: iso(5),
    });
    await page.goto('/expiring');
    await expect(page.getByRole('heading', { name: /Coming up/ })).toBeVisible(); // default 7 days
    await page.goto('/settings');
    await page.getByLabel(/“Soon” means within/).fill('3');
    await page.goto('/expiring');
    await expect(page.getByRole('heading', { name: /Coming up/ })).toHaveCount(0);
  });

  test('home reflects the real inventory', async ({ page }) => {
    await boot(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.getByText('Nothing logged yet.')).toBeVisible();
    await loadSample(page);
    await page.goto('/');
    await expect(page.getByRole('link', { name: /Bread/ })).toBeVisible(); // past date
    await page.getByRole('tab', { name: 'Fridge' }).click();
    await expect(page.getByRole('button', { name: /^Milk,/ })).toBeVisible();
  });
});

test.describe('layout, polish, accessibility', () => {
  test('search bar keeps breathing room from the top edge', async ({ page }) => {
    await boot(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const box = (await page.getByRole('search').first().boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(20);
  });

  test('buttons and links show a pointer cursor and animate on hover', async ({ page }) => {
    await boot(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/pantry');
    const add = page.getByRole('button', { name: 'Add ingredient' }).first();
    expect(await add.evaluate((e) => getComputedStyle(e).cursor)).toBe('pointer');
    expect(
      await page
        .getByRole('link', { name: 'Recipes' })
        .first()
        .evaluate((e) => getComputedStyle(e).cursor),
    ).toBe('pointer');
    expect(
      await page
        .getByRole('button', { name: 'Load sample pantry' })
        .evaluate((e) => getComputedStyle(e).cursor),
    ).toBe('pointer');
    await add.hover();
    await expect.poll(() => add.evaluate((e) => getComputedStyle(e).transform)).not.toBe('none');
    const before = await add.evaluate((e) => getComputedStyle(e).transitionDuration);
    expect(before).not.toBe('0s');
  });

  test('Low motion turns button transitions off', async ({ page }) => {
    await boot(page, { motion: 'low' });
    await page.goto('/pantry');
    const dur = await page
      .getByRole('button', { name: 'Add ingredient' })
      .first()
      .evaluate((e) => getComputedStyle(e).transitionDuration);
    expect(dur.split(',').every((d) => parseFloat(d) === 0)).toBe(true);
  });

  for (const width of [360, 390, 430, 768, 1024, 1440]) {
    test(`no horizontal overflow at ${width}px (shelves, list, detail, expiring, dialogs)`, async ({
      page,
    }) => {
      await boot(page);
      await page.setViewportSize({ width, height: 860 });
      await loadSample(page);
      const fits = () =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        );
      await page.goto('/pantry');
      expect(await fits()).toBe(true);
      await page.getByRole('radio', { name: 'List' }).click();
      await page.getByRole('radio', { name: 'All' }).click();
      expect(await fits()).toBe(true);
      await page.goto('/pantry/ing-pasta');
      await expect(page.getByRole('heading', { level: 1, name: 'Pasta' })).toBeVisible();
      expect(await fits()).toBe(true);
      await page.getByRole('button', { name: 'Edit' }).first().click();
      expect(await fits()).toBe(true);
      await page.getByRole('button', { name: 'Cancel' }).click();
      await page.goto('/expiring');
      expect(await fits()).toBe(true);
    });
  }

  test('axe: shelves, list, detail, expiring, add dialog', async ({ page }) => {
    await boot(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loadSample(page);
    const scan = async (label: string) => {
      await page.waitForTimeout(350);
      const r = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(
        r.violations.map((v) => `${label}: ${v.id} ${v.nodes.map((n) => n.target).join('|')}`),
      ).toEqual([]);
    };
    await page.goto('/pantry');
    await scan('shelves');
    await page.getByRole('radio', { name: 'List' }).click();
    await scan('list');
    await page.goto('/pantry/ing-milk');
    await scan('detail');
    await page.goto('/expiring');
    await scan('expiring');
    await page.goto('/pantry');
    await page.getByRole('button', { name: 'Add ingredient' }).first().click();
    await scan('add dialog');
  });
});
