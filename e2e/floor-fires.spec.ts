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

test('a contrast failure is reported', async ({ page }) => {
  await open(page);
  await page.addStyleTag({
    content: 'p { color: #bbb !important; background: #ccc !important; }',
  });

  expect(await accessibilityViolations(page)).toContainEqual(
    expect.stringContaining('color-contrast'),
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
  await page.addStyleTag({
    content: `p { font-size: ${LEGIBILITY_FLOOR.minBodyPx - 2}px !important; font-weight: 100 !important; }`,
  });

  const paragraphs = await bodyText(page);
  expect(paragraphs.length).toBeGreaterThan(0);
  expect(paragraphs.every((p) => p.px < LEGIBILITY_FLOOR.minBodyPx)).toBe(true);
  expect(
    paragraphs.every((p) => p.weight < LEGIBILITY_FLOOR.minBodyWeight),
  ).toBe(true);
});
