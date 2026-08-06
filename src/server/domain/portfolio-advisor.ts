import type { Issue } from '@/content/types';
import type { TemplateManifest } from '@/templates/types';

/**
 * The portfolio-strength advisor (docs/DIRECTION.md §7 Intelligence): nudges
 * from the content itself, not a gate. `validateIssue` says what is *wrong* and
 * blocks a publish; this says what would be *stronger* and blocks nothing. The
 * two are deliberately separate — a thin-but-valid portfolio is allowed to ship,
 * and telling someone their one project is a fine start reads very differently
 * from telling them it is an error.
 *
 * Every piece of advice is pure data derived from the `Issue` (and the chosen
 * design, so it never suggests filling a section the design does not show, and
 * can point out when the design and the content pull against each other). No AI
 * here: the deterministic nudges are the ones worth their false-positive rate,
 * and they stay unit-testable.
 */

/** A gap is a real hole a visitor would notice; a nudge is an improvement. */
export type AdviceLevel = 'gap' | 'nudge';

/** Where the fix lives, kept semantic so the UI owns the routing to a step. */
export type AdviceTarget =
  | 'about'
  | 'projects'
  | 'experience'
  | 'education'
  | 'metrics'
  | 'design';

export type Advice = {
  /** Stable key, so React and any future dismissal have something to hold. */
  id: string;
  level: AdviceLevel;
  message: string;
  target: AdviceTarget;
};

/** Only the parts of a manifest the advisor reasons about. */
type AdviceManifest = Pick<TemplateManifest<unknown>, 'name' | 'uses' | 'attributes'>;

const GAP: AdviceLevel = 'gap';
const NUDGE: AdviceLevel = 'nudge';

export function portfolioAdvice(issue: Issue, manifest: AdviceManifest | null): Advice[] {
  const advice: Advice[] = [];
  const { settings, projects, experiences, education, metrics } = issue;

  // An unknown template shows everything (the same fallback the content step
  // makes): with no manifest to say otherwise, no section is off the table.
  const shows = (part: keyof Issue) => manifest === null || manifest.uses.includes(part);
  const designName = manifest?.name ?? 'This design';

  // ── Identity: the first thing a visitor reads ──────────────────────────
  if (!settings.tagline.trim()) {
    advice.push({
      id: 'tagline',
      level: NUDGE,
      message: 'Add a one-line summary — it is the first thing a visitor reads.',
      target: 'about',
    });
  }

  if (!settings.contactEmail.trim() && settings.links.length === 0) {
    advice.push({
      id: 'contact',
      level: GAP,
      message: 'Add a way to reach you — an email or a link. A portfolio no one can act on stops short.',
      target: 'about',
    });
  }

  // ── Projects: what a portfolio is built around ─────────────────────────
  if (shows('projects')) {
    if (projects.length === 0) {
      advice.push({
        id: 'no-projects',
        level: GAP,
        message: 'Add a project — the work is what a portfolio is for.',
        target: 'projects',
      });
    } else if (projects.length === 1) {
      advice.push({
        id: 'one-project',
        level: NUDGE,
        message: 'One project is a start. Add another as you ship.',
        target: 'projects',
      });
    }

    const withoutImpact = projects.filter((project) => !project.impact.trim()).length;
    if (withoutImpact > 0) {
      const all = withoutImpact === projects.length;
      advice.push({
        id: 'impact',
        level: NUDGE,
        message: all
          ? 'None of your projects say what changed — add an impact line to each, in one sentence.'
          : `${withoutImpact} ${withoutImpact === 1 ? 'project has' : 'projects have'} no impact line — say what changed in one sentence.`,
        target: 'projects',
      });
    }

    // The design and the content pulling against each other: an image-forward
    // design with no images shows a lot of empty frames, and a text-led design
    // would carry the same work better. This is the DIRECTION.md nudge "no
    // pictures — a different template may suit you", made concrete off the new
    // `imagery` attribute.
    if (
      manifest?.attributes.imagery === 'image-forward' &&
      projects.length > 0 &&
      !projects.some((project) => project.images.length > 0)
    ) {
      advice.push({
        id: 'imagery-mismatch',
        level: NUDGE,
        message: `${designName} leads with images and your projects have none — add screenshots, or switch to a text-led design that carries the work without them.`,
        target: 'design',
      });
    }
  }

  // ── Sections the design leans on but the content leaves empty ──────────
  if (shows('experiences') && experiences.length === 0 && (!shows('projects') || projects.length > 0)) {
    advice.push({
      id: 'no-experience',
      level: NUDGE,
      message: 'Add a role — where the work was done gives it context.',
      target: 'experience',
    });
  }

  if (shows('metrics') && metrics.length === 0) {
    advice.push({
      id: 'no-metrics',
      level: NUDGE,
      message: `${designName} sets figures at display size and you have none — add one that shows impact.`,
      target: 'metrics',
    });
  }

  if (shows('education') && education.length === 0) {
    advice.push({
      id: 'no-education',
      level: NUDGE,
      message: `${designName} gives education real estate — add a school or credential to fill it.`,
      target: 'education',
    });
  }

  // Gaps first: a real hole outranks an improvement when both are on the page.
  return advice.sort((a, b) => Number(b.level === GAP) - Number(a.level === GAP));
}
