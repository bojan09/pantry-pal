import { expect, test, type Page } from '@playwright/test';

const PREFS_KEY = 'pantrypal.prefs.v1';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function boot(page: Page) {
  await page.addInitScript(
    ([k, v]) => {
      if (!localStorage.getItem(k as string)) localStorage.setItem(k as string, JSON.stringify(v));
    },
    [PREFS_KEY, { onboarded: true, name: 'Bojan', sampleContent: false }],
  );
}
const dialog = (page: Page) => page.getByRole('dialog');

test.describe('jar sizes', () => {
  test('ajvar and pickles default to medium jars; sizes are tracked separately', async ({
    page,
  }) => {
    await boot(page);
    await page.goto('/pantry');
    await page.getByRole('button', { name: 'Add ingredient' }).first().click();
    const d = dialog(page);
    await d.getByLabel('Search ingredients').fill('ajvar');
    await d.getByRole('button', { name: /^Ajvar/ }).click();
    await expect(d.getByLabel('Unit')).toHaveValue('jar-m'); // medium jar by default
    await expect(d.getByLabel('Unit').locator('option')).toContainText([
      'small jar',
      'medium jar',
      'large jar',
    ]);
    await d.getByLabel('Quantity').fill('2');
    await d.getByLabel('Unit').selectOption('jar-s');
    await d.getByRole('radio', { name: 'No date' }).click();
    await d.getByRole('button', { name: 'Add to storage' }).click();
    await expect(page.getByRole('button', { name: /^Ajvar, 2 small jars/ })).toBeVisible();

    await page.getByRole('button', { name: /^Ajvar,/ }).click();
    await page.getByRole('button', { name: 'Add stock' }).click();
    await d.getByLabel('Quantity').fill('1');
    await d.getByLabel('Unit').selectOption('jar-l');
    await d.getByRole('radio', { name: 'No date' }).click();
    await d.getByRole('button', { name: 'Add to storage' }).click();
    await expect(page.getByText('2 small jars + 1 large jar', { exact: true })).toBeVisible();

    // a different size cannot be used
    await page.getByRole('button', { name: 'Use some' }).click();
    await d.getByLabel('Amount used').fill('1');
    await d.getByLabel('Unit').selectOption('jar-m');
    await d.getByRole('button', { name: 'Use', exact: true }).click();
    await expect(d.getByRole('alert')).toContainText('no Ajvar that can be measured in medium jar');
    await d.getByLabel('Unit').selectOption('jar-s');
    await d.getByRole('button', { name: 'Use', exact: true }).click();
    await expect(page.getByText('1 small jar + 1 large jar', { exact: true })).toBeVisible();
  });

  test('pickles default to a medium jar', async ({ page }) => {
    await boot(page);
    await page.goto('/pantry');
    await page.getByRole('button', { name: 'Add ingredient' }).first().click();
    await dialog(page).getByLabel('Search ingredients').fill('pickles');
    await dialog(page)
      .getByRole('button', { name: /^Pickles/ })
      .click();
    await expect(dialog(page).getByLabel('Unit')).toHaveValue('jar-m');
  });
});

test.describe('logo', () => {
  test('desktop logo returns to the front page', async ({ page }) => {
    await boot(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/settings');
    await page.getByRole('link', { name: /^PantryPal/ }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1, name: /Good .*, Bojan!/ })).toBeVisible();
  });
  test('mobile logo returns to the front page', async ({ page }) => {
    await boot(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/pantry');
    await page.getByRole('link', { name: /^PantryPal/ }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe('profile picture', () => {
  for (const [label, size] of [
    ['desktop', { width: 1440, height: 900 }],
    ['mobile', { width: 390, height: 844 }],
  ] as const) {
    test(`upload, persist, open settings from avatar, remove (${label})`, async ({ page }) => {
      await boot(page);
      await page.setViewportSize(size);
      await page.goto('/');
      const topBarAvatar = page.getByRole('link', { name: /Profile and settings/ });
      await expect(topBarAvatar.locator('img')).toHaveCount(0); // initial until a photo is set
      await expect(topBarAvatar).toContainText('B');

      await topBarAvatar.click();
      await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
      await page
        .getByLabel('Profile picture')
        .setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG });
      await expect(topBarAvatar.locator('img[alt="Your profile picture"]')).toBeVisible();

      await page.reload();
      await expect(topBarAvatar.locator('img[alt="Your profile picture"]')).toBeVisible();
      const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), PREFS_KEY);
      expect(stored.avatarId).toBeTruthy();

      await page.getByRole('button', { name: 'Remove photo' }).click();
      await expect(topBarAvatar.locator('img')).toHaveCount(0);
      await expect(topBarAvatar).toContainText('B');
      await expect(page.getByRole('button', { name: 'Remove photo' })).toHaveCount(0);
    });
  }

  test('replacing a photo deletes the old one; non-images are rejected', async ({ page }) => {
    await boot(page);
    await page.goto('/settings');
    const input = page.getByLabel('Profile picture');
    await input.setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.locator('img[alt="Your profile picture"]').first()).toBeVisible();
    const img = page.locator('img[alt="Your profile picture"]').first();
    const before = await img.getAttribute('src');
    await input.setInputFiles({ name: 'b.png', mimeType: 'image/png', buffer: PNG });
    await expect.poll(() => img.getAttribute('src')).not.toBe(before); // swap finished
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const req = indexedDB.open('pantrypal');
          return new Promise<number>((res) => {
            req.onsuccess = () => {
              const tx = req.result.transaction('mediaAssets');
              const all = tx.objectStore('mediaAssets').getAll();
              all.onsuccess = () =>
                res((all.result as { kind: string }[]).filter((a) => a.kind === 'avatar').length);
            };
          });
        }),
      )
      .toBe(1);
    await input.setInputFiles({ name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') });
    await expect(page.getByRole('alert')).toContainText('JPEG, PNG or WebP');
  });
});
