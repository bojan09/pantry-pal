import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

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

async function addNote(
  page: Page,
  date: string,
  slot: string,
  text: string,
  extra?: () => Promise<void>,
) {
  await page
    .getByRole('button', { name: new RegExp(`Add to ${slot} on`) })
    .first()
    .click();
  await dialog(page)
    .getByRole('radio', { name: /A note/ })
    .click();
  await dialog(page).getByLabel('Note').fill(text);
  if (extra) await extra();
  await dialog(page).getByRole('button', { name: 'Add to plan' }).click();
  await expect(dialog(page)).toBeHidden();
}

test.describe('planner: ordering, repeat, copy, month', () => {
  test('reorders meals inside a slot', async ({ page }) => {
    await boot(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/planner?date=2031-03-05');
    await addNote(page, '2031-03-03', 'Snack', 'First');
    await addNote(page, '2031-03-03', 'Snack', 'Second');
    const names = async () =>
      (
        await page
          .locator('section[aria-label$="Snack"]')
          .first()
          .locator('article p')
          .allInnerTexts()
      ).filter((t) => !/servings?/.test(t));
    expect(await names()).toEqual(['First', 'Second']);
    await page.getByRole('button', { name: 'Edit or move Second' }).click();
    await dialog(page).getByRole('button', { name: 'Earlier in this meal' }).click();
    await expect
      .poll(async () => (await names()).map((t) => t.split('\n')[0]))
      .toEqual(['Second', 'First']);
  });

  test('repeats weekly and shows it in the month view', async ({ page }) => {
    await boot(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/planner?date=2031-03-05');
    await addNote(page, '2031-03-05', 'Lunch', 'Market day', async () => {
      await dialog(page).getByLabel('Repeat', { exact: true }).selectOption('week');
      await dialog(page).getByLabel('Number of extra repeats').fill('2');
    });
    await page.getByRole('radio', { name: 'Month' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'March 2031' })).toBeVisible();
    for (const d of ['March 3', 'March 10', 'March 17'])
      await expect(
        page.getByRole('gridcell', { name: new RegExp(`${d}: 1 planned: Market day`) }),
      ).toBeVisible();
    await expect(page.getByRole('gridcell', { name: /March 26: nothing planned/ })).toBeVisible();
    // pick a day → its week opens
    await page.getByRole('gridcell', { name: /March 17/ }).click();
    await page.getByRole('radio', { name: 'Week' }).click();
    await expect(
      page.getByRole('heading', { level: 2, name: /Mar 17 – Mar 23, 2031/ }),
    ).toBeVisible();
    await page.getByRole('radio', { name: 'Month' }).click();
    await page.getByRole('button', { name: 'Next month' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'April 2031' })).toBeVisible();
  });

  test('copies a whole week', async ({ page }) => {
    await boot(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/planner?date=2031-03-05');
    await expect(page.getByRole('button', { name: 'Copy week' })).toBeDisabled();
    await addNote(page, '2031-03-05', 'Dinner', 'Pizza night');
    await page.getByRole('button', { name: 'Copy week' }).click();
    await expect(dialog(page).getByText(/starts on March 10, 2031/)).toBeVisible();
    await dialog(page).getByRole('button', { name: 'Copy week' }).click();
    await expect(page.getByText('Copied 1 meal')).toBeVisible();
    await page.getByRole('button', { name: 'Next week' }).click();
    await expect(page.getByRole('article').filter({ hasText: 'Pizza night' })).toBeVisible();
  });

  test('earlier meals not marked done stay out of the shopping list, with a note', async ({
    page,
  }) => {
    await boot(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/planner?date=2020-03-04');
    await page
      .getByRole('button', { name: /Add to Dinner on/ })
      .first()
      .click();
    await dialog(page).getByLabel('Search recipes to plan').fill('Garden Salad');
    await dialog(page)
      .getByRole('button', { name: /Garden Salad/ })
      .click();
    await dialog(page).getByRole('button', { name: 'Add to plan' }).click();
    await expect(page.getByText(/1 earlier meal this week is not marked done/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Shopping list for this week' })).toBeDisabled();
  });

  test('touch: press and hold, then drag a meal to another day', async ({ browser }) => {
    const ctx = await browser.newContext({
      hasTouch: true,
      viewport: { width: 1440, height: 1000 },
    });
    const page = await ctx.newPage();
    await boot(page);
    await page.goto('/planner?date=2031-03-05');
    await addNote(page, '2031-03-03', 'Dinner', 'Soup night');
    const from = page.locator('section[aria-label$="Dinner"]').first();
    const art = from.getByRole('article');
    const target = page.locator('section[aria-label^="Thursday"][aria-label$="Lunch"]');
    const a = (await art.boundingBox())!;
    const t = (await target.boundingBox())!;
    const cdp = await ctx.newCDPSession(page);
    const pt = (x: number, y: number) => [{ x, y }];
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: pt(a.x + 40, a.y + 20),
    });
    await page.waitForTimeout(600); // hold
    for (let i = 1; i <= 8; i++)
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: pt(
          a.x + 40 + ((t.x + 40 - a.x - 40) * i) / 8,
          a.y + 20 + ((t.y + 20 - a.y - 20) * i) / 8,
        ),
      });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(target.getByRole('article').filter({ hasText: 'Soup night' })).toBeVisible();
    await expect(from.getByRole('article')).toHaveCount(0);
    await ctx.close();
  });
});

test.describe('cooking: lots, undo', () => {
  test('choose exact lots, finish, then undo from history', async ({ page }) => {
    await boot(page);
    await loadSample(page);
    await page.goto('/recipes/spaghetti-aglio-olio/cook');
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Finish cooking' }).click();
    const d = dialog(page);
    const pasta = d
      .getByRole('list', { name: 'Ingredients used' })
      .getByRole('listitem')
      .filter({ hasText: 'Pasta' })
      .first();
    await pasta.getByText(/Choose which lots/).click();
    const lots = pasta.getByRole('list', { name: 'Pasta lots' });
    await expect(lots.getByRole('listitem').first()).toContainText('earliest');
    // use the later lot instead of the earliest one
    await pasta.getByLabel(/Pasta: amount from Pantry lot 1/).fill('0');
    await pasta.getByLabel(/Pasta: amount from Pantry lot 2/).fill('200');
    await expect(pasta.getByLabel('Pasta amount used')).toHaveValue('200');
    await d.getByRole('button', { name: 'Confirm and update pantry' }).click();
    await expect(page.getByText(/Pantry updated for/)).toBeVisible();

    await page.goto('/pantry/ing-pasta');
    await expect(page.getByText('300 g').first()).toBeVisible();
    await expect(page.getByText('500 g').first()).toBeVisible();

    await page.goto('/history');
    await page.getByRole('button', { name: 'Undo and put the ingredients back' }).click();
    await dialog(page).getByRole('button', { name: 'Put ingredients back' }).click();
    await expect(page.getByText('Undone. Your pantry is back as it was.')).toBeVisible();
    await expect(page.getByText('Undone: pantry stock was put back')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Undo and put the ingredients back' }),
    ).toHaveCount(0);
    await page.goto('/pantry/ing-pasta');
    await expect(page.getByText(/1 kg/).first()).toBeVisible();
  });
});

test.describe('recipe import/export', () => {
  test('exports a recipe file and imports it back as a personal recipe', async ({ page }) => {
    await boot(page);
    await page.goto('/recipes/chickpea-curry');
    const [dl] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export' }).click(),
    ]);
    expect(dl.suggestedFilename()).toBe('chickpea-curry.recipe.json');
    const text = readFileSync((await dl.path())!, 'utf8');
    expect(JSON.parse(text)).toMatchObject({ format: 'pantrypal.recipe', version: 1 });

    await page.goto('/recipes');
    await page.getByRole('button', { name: 'Import' }).click();
    await dialog(page).getByLabel('Or paste the recipe text').fill('not json');
    await expect(dialog(page).getByRole('alert')).toContainText('not valid JSON');
    await expect(dialog(page).getByRole('button', { name: 'Import recipe' })).toBeDisabled();
    const edited = text
      .replace('Chickpea Curry', 'My Curry')
      .replace('Canned chickpeas', 'Mystery bean');
    await dialog(page).getByLabel('Or paste the recipe text').fill(edited);
    await expect(dialog(page).getByText(/will be added as your own: Mystery bean/)).toBeVisible();
    await dialog(page).getByRole('button', { name: 'Import recipe' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'My Curry' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Edit' })).toBeVisible(); // personal, editable
    await expect(page.getByRole('link', { name: 'Mystery bean' })).toBeVisible();
  });
});
