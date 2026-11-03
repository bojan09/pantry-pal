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

async function loadSample(page: Page) {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Load sample pantry' }).click();
  await expect(page.getByText(/Loaded 29 sample items/)).toBeVisible();
}

const dialog = (page: Page) => page.getByRole('dialog');
const search = (page: Page) => page.getByRole('searchbox', { name: 'Search recipes', exact: true });

test.describe('cookbook', () => {
  test('ships a starter cookbook that is searchable and filterable', async ({ page }) => {
    await boot(page);
    await page.goto('/recipes');
    await expect(page.getByText(/^\d+ of 33 recipes$/)).toHaveText('33 of 33 recipes');
    await search(page).fill('lentil');
    await expect(page.getByRole('heading', { name: 'Red Lentil Soup' })).toBeVisible();
    await expect(page.getByText('1 of 33 recipes')).toBeVisible();
    // ingredient search matches aliases ("courgette" is an alias of zucchini)
    await search(page).fill('courgette');
    await expect(page.getByRole('heading', { name: 'Zucchini Fritters' })).toBeVisible();
    await search(page).fill('');

    await page.getByRole('combobox', { name: 'Category' }).selectOption('Dessert');
    await expect(page.getByRole('heading', { name: 'Fudgy Chocolate Brownies' })).toBeVisible();
    await page.getByRole('combobox', { name: 'Category' }).selectOption('');
    await page.getByRole('combobox', { name: 'Total time' }).selectOption('15');
    await expect(page.getByRole('heading', { name: 'Garden Salad' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Baked Beans, Balkan Style' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Clear filters' }).first().click();
    await expect(page.getByText('33 of 33 recipes')).toBeVisible();
  });

  test('favourites persist and sort first', async ({ page }) => {
    await boot(page);
    await page.goto('/recipes');
    await page.getByRole('button', { name: 'Add Shopska Salad to favourites' }).click();
    await expect(
      page.getByRole('button', { name: 'Remove Shopska Salad from favourites' }),
    ).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Favourites', exact: true }).click();
    await expect(page.getByText('1 of 33 recipes')).toBeVisible();
    await page.getByRole('button', { name: 'Favourites', exact: true }).click();
    await page.getByRole('combobox', { name: 'Sort by' }).selectOption('favorites');
    await expect(page.getByRole('heading', { level: 3 }).first()).toHaveText('Shopska Salad');
  });

  test('scales servings with sensible amounts and flags estimates', async ({ page }) => {
    await boot(page);
    await page.goto('/recipes/garden-frittata');
    const ing = page
      .getByRole('listitem')
      .filter({ has: page.getByRole('link', { name: 'Eggs' }) });
    await expect(ing.getByText('6 pcs')).toBeVisible();
    await page.getByRole('button', { name: 'More servings' }).click();
    await expect(page.getByText('4 servings')).toBeVisible();
    await expect(ing.getByText('8 pcs')).toBeVisible();
    await expect(page.getByText(/do not always scale in a straight line/)).toBeVisible();
    await expect(page.getByTitle('Estimate: adjust to taste')).toBeVisible();
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(page.getByText('3 servings')).toBeVisible();
    await expect(page.getByText(/do not always scale/)).toHaveCount(0);
  });

  test('creates, edits and deletes a personal recipe, adding a custom ingredient', async ({
    page,
  }) => {
    await boot(page);
    await page.goto('/recipes/new');
    await page.getByRole('button', { name: 'Save recipe' }).click();
    await expect(page.getByRole('alert')).toContainText('Give the recipe a name');

    await page.getByLabel('Name', { exact: true }).fill('My Test Toast');
    await page.getByLabel('Ingredient 1 name').fill('Bread');
    await page.getByLabel('Ingredient 1 amount').fill('2');
    await page.getByLabel('Ingredient 1 unit').selectOption('pcs');
    await page.getByLabel('Ingredient 2 name').fill('Dragon fruit jam');
    await page.getByLabel('Ingredient 2 amount').fill('1');
    await page.getByLabel('Ingredient 2 unit').selectOption('tbsp');
    await page.getByLabel('Step 1', { exact: true }).fill('Toast the bread.');
    await page.getByLabel('Step 1 timer in minutes').fill('3');
    await page.getByLabel('Step 2', { exact: true }).fill('Spread the jam.');
    await page.getByRole('button', { name: 'Save recipe' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'My Test Toast' })).toBeVisible();
    await expect(page.getByText(/Added 1 new ingredient: Dragon fruit jam/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dragon fruit jam' })).toBeVisible();
    await expect(page.getByText('About 3 min')).toBeVisible();

    await page.getByRole('link', { name: 'Edit' }).click();
    await page.getByLabel('Name', { exact: true }).fill('My Test Toast v2');
    await page.getByRole('button', { name: 'Save recipe' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'My Test Toast v2' })).toBeVisible();

    await page.getByRole('button', { name: 'Delete' }).click();
    await dialog(page).getByRole('button', { name: 'Delete recipe' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Recipes' })).toBeVisible();
    await expect(page.getByText('33 of 33 recipes')).toBeVisible();
  });

  test('starter recipes are read-only but can be duplicated', async ({ page }) => {
    await boot(page);
    await page.goto('/recipes/garden-frittata');
    await expect(page.getByRole('link', { name: 'Edit' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Duplicate' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Edit recipe' })).toBeVisible();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Garden Frittata (copy)');
    await page.goto('/recipes/garden-frittata/edit');
    await expect(page.getByText('Starter recipes are read-only')).toBeVisible();
  });

  test('collections: create from a recipe, filter by it, rename and delete', async ({ page }) => {
    await boot(page);
    await page.goto('/recipes/garden-frittata');
    await page.getByRole('button', { name: 'Collections' }).click();
    await dialog(page).getByLabel('New collection').fill('Brunch');
    await dialog(page).getByRole('button', { name: 'Create' }).click();
    await expect(dialog(page).getByRole('checkbox', { name: 'Brunch' })).toBeChecked();
    await dialog(page).getByRole('button', { name: 'Done' }).click();

    await page.goto('/collections');
    await expect(page.getByRole('heading', { name: 'Brunch' })).toBeVisible();
    await expect(page.getByText('1 recipe', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Open' }).click();
    await expect(page.getByText('1 of 33 recipes')).toBeVisible();

    await page.goto('/collections');
    await page.getByRole('button', { name: 'Rename Brunch' }).click();
    await dialog(page).getByLabel('Name').fill('Weekend brunch');
    await dialog(page).getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('heading', { name: 'Weekend brunch' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete Weekend brunch' }).click();
    await dialog(page).getByRole('button', { name: 'Delete collection' }).click();
    await expect(page.getByText('No collections yet')).toBeVisible();
    // the recipe itself is untouched
    await page.goto('/recipes/garden-frittata');
    await expect(page.getByRole('heading', { level: 1, name: 'Garden Frittata' })).toBeVisible();
  });

  test('the cookbook and a recipe open offline', async ({ page, context }) => {
    await boot(page);
    await page.goto('/recipes');
    await expect(page.getByText('33 of 33 recipes')).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    await page.goto('/recipes/chickpea-curry');
    await expect(page.getByRole('heading', { level: 1, name: 'Chickpea Curry' })).toBeVisible();
    await expect(page.getByText('Method')).toBeVisible();
    await context.setOffline(false);
  });
});

test.describe('cooking mode', () => {
  test('cook through: pantry untouched until confirmed, then deducted once', async ({ page }) => {
    await boot(page);
    await loadSample(page);
    await page.goto('/pantry/ing-pasta');
    await expect(page.getByText(/1 kg/).first()).toBeVisible();

    await page.goto('/recipes/spaghetti-aglio-olio');
    await expect(page.getByText('Your pantry covers 3 of 5 required ingredients.')).toBeVisible();
    await expect(page.getByText('Not in pantry').first()).toBeVisible();
    await expect(page.getByText('Have 3 pcs')).toBeVisible();
    await page.getByRole('link', { name: 'Start cooking' }).click();
    await expect(page.getByText('Step 1 of 4')).toBeVisible();

    // keyboard navigation
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText('Step 2 of 4')).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByText('Step 1 of 4')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Finish cooking' }).click();

    const d = dialog(page);
    await expect(d.getByRole('heading', { name: 'Update your pantry?' })).toBeVisible();
    // pasta, oil and salt ticked; garlic clamped to what is on hand; chilli not ticked
    await expect(d.getByRole('checkbox', { name: 'Pasta' })).toBeChecked();
    await expect(d.getByRole('checkbox', { name: 'Garlic' })).toBeChecked();
    await expect(d.getByRole('checkbox', { name: 'Chili flakes' })).not.toBeChecked();
    await expect(d.getByRole('checkbox', { name: 'Salt' })).toBeChecked();
    await expect(d.getByLabel('Garlic amount used')).toHaveValue('3');
    await d.getByLabel('Pasta amount used').fill('250');
    // an impossible amount blocks confirmation
    await d.getByLabel('Pasta amount used').fill('5000');
    await expect(d.getByRole('alert').filter({ hasText: /Only .* on hand/ })).toBeVisible();
    await expect(d.getByRole('button', { name: 'Confirm and update pantry' })).toBeDisabled();
    await d.getByLabel('Pasta amount used').fill('250');
    await d.getByRole('radio', { name: '4 stars' }).click();
    await d.getByLabel('Notes for next time (optional)').fill('Needs more garlic');

    // stock still unchanged before confirmation
    await d.getByRole('button', { name: 'Back to cooking' }).click();
    await page.goto('/pantry/ing-pasta');
    await expect(page.getByText(/1 kg/).first()).toBeVisible();

    await page.goto('/recipes/spaghetti-aglio-olio');
    await page.getByRole('link', { name: 'Resume cooking' }).click();
    await expect(page.getByText('Step 4 of 4')).toBeVisible(); // progress persisted
    await page.getByRole('button', { name: 'Finish cooking' }).click();
    await d.getByLabel('Pasta amount used').fill('250');
    await d.getByRole('radio', { name: '4 stars' }).click();
    await d.getByRole('button', { name: 'Confirm and update pantry' }).click();
    await expect(page.getByText(/Pantry updated for \d ingredients?/)).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Spaghetti Aglio e Olio' }),
    ).toBeVisible();

    await page.goto('/pantry/ing-pasta');
    await expect(page.getByText(/750 g/).first()).toBeVisible();
    await page.goto('/pantry/ing-garlic');
    await expect(page.getByText('No stock logged.')).toBeVisible();

    await page.goto('/history');
    await expect(page.getByRole('heading', { name: 'Spaghetti Aglio e Olio' })).toBeVisible();
    await expect(page.getByText(/Used from pantry: .*Pasta \(250 g\)/)).toBeVisible();
    await expect(page.getByLabel('Rated 4 out of 5')).toBeVisible();
    // finishing is not repeatable
    await page.goto('/recipes/spaghetti-aglio-olio');
    await expect(page.getByRole('link', { name: 'Start cooking' })).toBeVisible();
  });

  test('stopping leaves the pantry exactly as it was', async ({ page }) => {
    await boot(page);
    await loadSample(page);
    await page.goto('/recipes/spaghetti-aglio-olio/cook');
    await expect(page.getByText('Step 1 of 4')).toBeVisible();
    await page.getByRole('button', { name: 'Stop cooking' }).click();
    await dialog(page).getByRole('button', { name: 'Stop cooking' }).click();
    await expect(page.getByText('Stopped. Your pantry was not changed.')).toBeVisible();
    await page.goto('/pantry/ing-pasta');
    await expect(page.getByText(/1 kg/).first()).toBeVisible();
    await page.goto('/history');
    await expect(page.getByText('Nothing cooked yet')).toBeVisible();
  });

  test('timers survive a reload and show when they have finished', async ({ page }) => {
    await boot(page);
    await page.goto('/recipes/spaghetti-aglio-olio/cook');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: /Start 3 min timer/ }).click();
    await expect(page.getByRole('timer', { name: /Step 3/ })).toBeVisible();

    await page.getByRole('button', { name: 'Pause Step 3' }).click();
    await expect(page.getByText('Paused')).toBeVisible();
    await page.reload();
    const frozen = await page.getByRole('timer', { name: /Step 3/ }).textContent();
    await page.waitForTimeout(1500);
    await expect(page.getByRole('timer', { name: /Step 3/ })).toHaveText(frozen!);
    await page.getByRole('button', { name: 'Resume Step 3' }).click();
    await expect(page.getByText('Paused')).toHaveCount(0);

    await page.getByLabel('Timer minutes').fill('0.03');
    await page.getByLabel('Timer label (optional)').fill('Quick check');
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(page.getByText("Time's up")).toBeVisible({ timeout: 8000 });

    await page.reload();
    await expect(page.getByText('Step 3 of 4')).toBeVisible();
    const t = page.getByRole('timer', { name: /Step 3/ });
    await expect(t).toBeVisible();
    await expect(t).toHaveText(/^(2:[0-5]\d|3:00)$/);
    await expect(page.getByText("Time's up")).toBeVisible(); // finished while away, still shown
    await page.getByRole('button', { name: 'Dismiss Quick check' }).click();
    await expect(page.getByText("Time's up")).toHaveCount(0);
    await page.getByRole('button', { name: 'Cancel Step 3' }).click();
    await expect(page.getByText('No timers running.')).toBeVisible();
  });

  test('works on a phone: swipe between steps and tick ingredients', async ({ page }) => {
    await boot(page);
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/recipes/garden-frittata/cook');
    await expect(page.getByText('Step 1 of 5')).toBeVisible();
    const card = page.locator('.pp-card.touch-pan-y');
    const box = (await card.boundingBox())!;
    await page.mouse.move(box.x + box.width - 20, box.y + 60);
    await page.mouse.down();
    await page.mouse.move(box.x + 20, box.y + 62, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByText('Step 2 of 5')).toBeVisible();
    await page.getByRole('button', { name: /Ingredients/ }).click();
    await page.getByRole('checkbox', { name: /Eggs/ }).click();
    await expect(page.getByRole('checkbox', { name: /Eggs/ })).toBeChecked();
    await page.reload();
    await page.getByRole('button', { name: /Ingredients/ }).click();
    await expect(page.getByRole('checkbox', { name: /Eggs/ })).toBeChecked();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
});

test.describe('accessibility', () => {
  for (const [name, path] of [
    ['recipes', '/recipes'],
    ['recipe detail', '/recipes/chickpea-curry'],
    ['new recipe', '/recipes/new'],
    ['collections', '/collections'],
    ['history', '/history'],
    ['cooking', '/recipes/chickpea-curry/cook'],
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
});
