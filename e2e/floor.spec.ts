import { expect, test } from '@playwright/test';

import { LEGIBILITY_FLOOR } from '../src/templates/floor';
// Manifests, not the registry: importing a template pulls its component and
// therefore its stylesheet, which Playwright's transform cannot parse.
import { listManifests } from '../src/templates/manifests';

import {
  accessibilityViolations,
  bodyText,
  headingLevels,
  settle,
  skippedLevels,
} from './floor-checks';

/**
 * The floor is the only thing templates share (plan §6), so it is the only
 * check that has to keep working as templates multiply. Everything here runs
 * per registered manifest against the tenant the seed gives each one, so
 * registering a template is what adds its coverage — not editing this file.
 *
 * `floor-fires.spec.ts` is the other half: it proves these measurements can
 * fail.
 */

const PORT = 3100;
const THEMES = ['light', 'dark'] as const;

const at = (subdomain: string, theme: string) =>
  `http://${subdomain}.localhost:${PORT}/?theme=${theme}`;

for (const manifest of listManifests()) {
  test.describe(`${manifest.id} floor`, () => {
    for (const theme of THEMES) {
      test(`meets WCAG AA in ${theme}`, async ({ page }) => {
        await page.goto(at(manifest.id, theme));
        await settle(page);
        expect(await accessibilityViolations(page)).toEqual([]);
      });
    }

    test('has one h1 and no skipped heading levels', async ({ page }) => {
      // Not axe's `heading-order`, which catches skips but is indifferent to a
      // page with two h1s or none. A portfolio's h1 is the person's name.
      await page.goto(at(manifest.id, 'light'));
      await settle(page);

      const levels = await headingLevels(page);
      expect(levels.filter((level) => level === 1)).toHaveLength(1);
      expect(levels[0]).toBe(1);
      expect(skippedLevels(levels)).toEqual([]);
    });

    test('renders its content as DOM, not canvas', async ({ page }) => {
      await page.goto(at(manifest.id, 'light'));
      await settle(page);

      // Plan §20.7 rule 1. Canvas content is invisible to screen readers and to
      // search engines, and a portfolio that does not surface in a search for
      // the person's name has failed at its only job.
      const name = await page.getByRole('heading', { level: 1 }).innerText();
      expect(await page.locator('body').innerText()).toContain(name);
    });

    test(`keeps body text at or above ${LEGIBILITY_FLOOR.minBodyPx}px`, async ({
      page,
    }) => {
      await page.goto(at(manifest.id, 'light'));
      await settle(page);

      // A hairline weight at 13px passes every contrast ratio and is still
      // unreadable, which is why the floor carries a size as well as a ratio.
      const paragraphs = await bodyText(page);
      expect(paragraphs.length).toBeGreaterThan(0);

      for (const paragraph of paragraphs) {
        expect(paragraph.px, `'${paragraph.text}…'`).toBeGreaterThanOrEqual(
          LEGIBILITY_FLOOR.minBodyPx,
        );
        expect(paragraph.weight, `'${paragraph.text}…'`).toBeGreaterThanOrEqual(
          LEGIBILITY_FLOOR.minBodyWeight,
        );
      }
    });
  });
}
