import type { Advice, AdviceTarget } from '@/server/domain/portfolio-advisor';

import { stepHref } from './Steps';

/**
 * The portfolio-strength advisor's nudges, rendered as a pre-flight before
 * publish (docs/DIRECTION.md §7). Advice, not a gate: it never disables the
 * publish button — a thin-but-valid portfolio is allowed to ship — so every
 * item links back to the step that fixes it rather than blocking the way
 * forward.
 *
 * Server component: the advice is computed from the draft on the server and has
 * no interaction of its own beyond the links.
 */

/** Which step (and section anchor) a piece of advice sends you to. */
const TARGET: Record<AdviceTarget, { step: 'design' | 'content'; anchor?: string; label: string }> = {
  about: { step: 'content', anchor: 'about', label: 'Edit about' },
  projects: { step: 'content', anchor: 'projects', label: 'Edit projects' },
  experience: { step: 'content', anchor: 'experience', label: 'Edit experience' },
  education: { step: 'content', anchor: 'education', label: 'Edit education' },
  metrics: { step: 'content', anchor: 'metrics', label: 'Edit metrics' },
  design: { step: 'design', label: 'Change design' },
};

export function StrengthAdvisor({ siteId, advice }: { siteId: string; advice: Advice[] }) {
  if (advice.length === 0) {
    return (
      <p className="admin-note admin-advice-clear">
        Looking strong — every section this design shows is filled in.
      </p>
    );
  }

  return (
    <ul className="admin-advice">
      {advice.map((item) => {
        const to = TARGET[item.target];
        const href = to.anchor
          ? `${stepHref(siteId, to.step)}#${to.anchor}`
          : stepHref(siteId, to.step);

        return (
          <li className="advice-item" key={item.id}>
            <span className={`advice-tag advice-${item.level}`}>
              {item.level === 'gap' ? 'Gap' : 'Nudge'}
            </span>
            <span className="advice-message">{item.message}</span>
            <a className="advice-fix" href={href}>
              {to.label} →
            </a>
          </li>
        );
      })}
    </ul>
  );
}
