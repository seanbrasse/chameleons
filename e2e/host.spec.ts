import { expect, test } from '@playwright/test';

const PORT = 3100;
const at = (host: string, path = '/') => `http://${host}localhost:${PORT}${path}`;

test('the apex serves marketing', async ({ page }) => {
  await page.goto(at(''));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chameleons');
});

test('a subdomain serves that tenant', async ({ page }) => {
  await page.goto(at('sean.'));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sean Brasse');
});

test('the app subdomain serves the builder', async ({ page }) => {
  await page.goto(at('app.'));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Builder');
});

test('an unclaimed subdomain is a 404', async ({ page }) => {
  const response = await page.goto(at('nobody.'));
  expect(response?.status()).toBe(404);
});

test('the internal render path is not reachable from the apex', async ({ page }) => {
  const response = await page.goto(at('', '/s/sean'));
  expect(response?.status()).toBe(404);
});
