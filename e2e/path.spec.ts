import { expect, test } from '@playwright/test';

test('the root serves marketing', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chameleons');
});

test('/s/<subdomain> serves that tenant', async ({ page }) => {
  await page.goto('/s/sean');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sean Brasse');
});

test('/app serves the builder', async ({ page }) => {
  await page.goto('/app');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Builder');
});

test('an unclaimed subdomain is a 404', async ({ page }) => {
  const response = await page.goto('/s/nobody');
  expect(response?.status()).toBe(404);
});
