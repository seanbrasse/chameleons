import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/**
 * The measurements the floor is made of, extracted so two specs can share them:
 * `floor.spec.ts` asserts a template is clean, `floor-fires.spec.ts` injects a
 * defect and asserts the same measurement reports it.
 *
 * That pairing is the point. A check nothing has ever seen fail is
 * indistinguishable from a check that cannot fail.
 */

export type BodyText = { text: string; px: number; weight: number };

/**
 * The carousel settles asynchronously and axe reads computed styles, so a scan
 * mid-transition can measure an element against a background it is still
 * crossing. Reduced motion is set on the project; this waits for the rest.
 */
export async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

export async function accessibilityViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  // Rule plus one offending element. '3 violations' sends you to the HTML
  // report; 'color-contrast: .project-status' is already the fix.
  return violations.map(
    (violation) => `${violation.id}: ${violation.nodes[0]?.target.join(' ')}`,
  );
}

export function headingLevels(page: Page): Promise<number[]> {
  return page
    .locator('h1, h2, h3, h4, h5, h6')
    .evaluateAll((nodes) => nodes.map((node) => Number(node.tagName[1])));
}

/** Levels that jump by more than one from the heading before them. */
export function skippedLevels(levels: number[]): number[] {
  return levels.filter((level, index) => {
    const previous = levels[index - 1];
    return previous !== undefined && level > previous + 1;
  });
}

/** Paragraphs long enough to be prose rather than a label or a date. */
export function bodyText(page: Page): Promise<BodyText[]> {
  return page.locator('p').evaluateAll((nodes) =>
    nodes
      .filter((node) => (node.textContent ?? '').trim().length > 40)
      .map((node) => {
        const style = getComputedStyle(node);
        return {
          text: (node.textContent ?? '').trim().slice(0, 40),
          px: parseFloat(style.fontSize),
          weight: Number(style.fontWeight),
        };
      }),
  );
}
