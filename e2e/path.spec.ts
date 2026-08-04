import { expect, test } from '@playwright/test';

test('the root serves marketing', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chameleons');
});

test('/s/<subdomain> serves that tenant', async ({ page }) => {
  await page.goto('/s/sean');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sean Brasse');
});

/**
 * The redirect has to keep the `/app` prefix. A bare `/enter` would resolve as
 * marketing and 404, which is the whole reason builder links are built through
 * `builderPath` rather than written literally.
 */
test('the builder sends a signed-out visitor to the door beneath /app', async ({ page }) => {
  await page.goto('/app');
  await expect(page).toHaveURL(/\/app\/enter$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sign in');
});

test('an unclaimed subdomain is a 404', async ({ page }) => {
  const response = await page.goto('/s/nobody');
  expect(response?.status()).toBe(404);
});
