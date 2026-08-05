import { expect, test, type Page } from '@playwright/test';

import { LEGIBILITY_FLOOR } from '../src/templates/floor';
import { DEFAULT_TEMPLATE_ID } from '../src/templates/manifests';

import {
  accessibilityViolations,
  bodyText,
  headingLevels,
  settle,
  skippedLevels,
} from './floor-checks';

/**
 * Proves the floor can fail. Each test injects the defect its counterpart in
 * `floor.spec.ts` claims to catch, then asserts the measurement reports it.
 *
 * Two of the six anti-slop lint rules silently matched nothing when they were
 * written, and `npm run lint` reported success the whole time — the same shape
 * of mistake, which is why `lint-rules.test.ts` exists. A floor that has never
 * been seen to fail is a floor nobody has checked.
 *
 * One template is enough here: this tests the measurements, not the designs.
 */

const PORT = 3100;
const URL = `http://${DEFAULT_TEMPLATE_ID}.localhost:${PORT}/?theme=light`;

async function open(page: Page) {
  await page.goto(URL);
  await settle(page);
}

/**
 * Inject a defect and measure, retrying until the injection actually took.
 *
 * `settle()` waits for networkidle and an `h1`, which is not the same as
 * hydration being finished — the timeline is a client component, and React 19
 * reconciles `<head>` stylesheets. A `<style>` added by Playwright in the window
 * before hydration completes can be dropped again, and the measurement then
 * reads the design's own sizes. It passed locally three times in a row and
 * failed in CI, which is the signature of exactly that race.
 *
 * Re-adding the tag each attempt is harmless and makes the outcome depend on
 * the measurement rather than on when hydration happened to land. The probe's
 * meaning is unchanged: it still has to observe the floor reporting the defect.
 */
async function withDefect<T>(
  page: Page,
  css: string,
  measure: () => Promise<T>,
  holds: (value: T) => boolean,
) {
  await expect
    .poll(
      async () => {
        await page.addStyleTag({ content: css });
        return holds(await measure());
      },
      { message: `the injected defect never took effect: ${css}` },
    )
    .toBe(true);
}

test('a contrast failure is reported', async ({ page }) => {
  await open(page);

  await withDefect(
    page,
    'p { color: #bbb !important; background: #ccc !important; }',
    () => accessibilityViolations(page),
    (violations) => violations.some((entry) => entry.startsWith('color-contrast')),
  );
});

test('an image with no alt text is reported', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const img = document.createElement('img');
    img.src =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    document.body.append(img);
  });

  expect(await accessibilityViolations(page)).toContainEqual(
    expect.stringContaining('image-alt'),
  );
});

test('a second h1 is reported', async ({ page }) => {
  await open(page);
  await page.evaluate(() => document.body.append(document.createElement('h1')));

  const levels = await headingLevels(page);
  expect(levels.filter((level) => level === 1)).toHaveLength(2);
});

test('a skipped heading level is reported', async ({ page }) => {
  await open(page);
  await page.evaluate(() => document.body.append(document.createElement('h5')));

  expect(skippedLevels(await headingLevels(page)).length).toBeGreaterThan(0);
});

test('body text below the legibility floor is reported', async ({ page }) => {
  await open(page);

  expect((await bodyText(page)).length).toBeGreaterThan(0);

  await withDefect(
    page,
    `p { font-size: ${LEGIBILITY_FLOOR.minBodyPx - 2}px !important; font-weight: 100 !important; }`,
    () => bodyText(page),
    (paragraphs) =>
      paragraphs.length > 0 &&
      paragraphs.every((p) => p.px < LEGIBILITY_FLOOR.minBodyPx) &&
      paragraphs.every((p) => p.weight < LEGIBILITY_FLOOR.minBodyWeight),
  );
});
