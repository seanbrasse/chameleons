import { expect, test } from '@playwright/test';

const PORT = 3100;
const at = (host: string, path = '/') => `http://${host}localhost:${PORT}${path}`;

test('the apex serves marketing', async ({ page }) => {
  await page.goto(at(''));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Your work, in a design that suits it.',
  );
});

/**
 * The builder shares the apex with marketing now, so the same origin has to
 * answer both. `/sites` is the dashboard, and a signed-out visitor is sent to
 * the door rather than shown someone's portfolios.
 */
test('the apex also serves the builder', async ({ page }) => {
  await page.goto(at('', '/sites'));
  await expect(page).toHaveURL(at('', '/enter'));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sign in');
});

test('a subdomain serves that tenant', async ({ page }) => {
  await page.goto(at('sean.'));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sean Brasse');
});

/**
 * `app.` was the builder's only home and still answers, so existing links keep
 * working. In production a Vercel redirect canonicalises it onto the apex; under
 * `next start` (no `vercel.json`) that edge redirect is absent, so the sign-in
 * screen's own apex guard is what moves the browser over. Either way a login can
 * only ever begin on the apex — which is the whole point: sign-in keeps its PKCE
 * verifier in a host-only cookie, so a flow that started on `app.` and finished
 * on the apex would lose it and bounce the user back to the door.
 */
test('the old builder host moves you to the apex before sign-in', async ({ page }) => {
  await page.goto(at('app.', '/sites/abc'));
  // The signed-out gate sends to `/enter`, then the apex guard rewrites the
  // origin — so the buttons render on the apex, not on `app.`.
  await expect(page).toHaveURL(at('', '/enter'));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sign in');
});

test('an unclaimed subdomain is a 404', async ({ page }) => {
  const response = await page.goto(at('nobody.'));
  expect(response?.status()).toBe(404);
});

test('the internal render path is not reachable from the apex', async ({ page }) => {
  const response = await page.goto(at('', '/s/sean'));
  expect(response?.status()).toBe(404);
});

test('a published portfolio carries its own title, not the platform’s', async ({ page }) => {
  await page.goto(at('sean.'));

  // Before this existed, every tenant inherited the root layout's "Chameleons".
  await expect(page).toHaveTitle('Sean Brasse');

  const description = page.locator('meta[name="description"]');
  await expect(description).toHaveAttribute('content', /.+/);

  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    'Sean Brasse',
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    at('sean.').replace(/\/$/, ''),
  );
});

test('the apex still carries the platform’s title', async ({ page }) => {
  await page.goto(at(''));
  await expect(page).toHaveTitle('Chameleons');
});
