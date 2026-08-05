import { builderHref } from '@/lib/tenant-config';

export const STEPS = [
  { id: 'design', n: '01', title: 'Design', note: 'Decides what content is worth entering' },
  { id: 'content', n: '02', title: 'Content', note: 'Saved as you go' },
  { id: 'publish', n: '03', title: 'Publish', note: 'The last step' },
] as const;

export type StepId = (typeof STEPS)[number]['id'];

export function stepHref(siteId: string, step: StepId): string {
  return builderHref(`/sites/${siteId}/${step}`);
}

/**
 * The builder as a sequence rather than one long page.
 *
 * Three screens, each its own route. The page it replaced put design, content
 * and publish in one column with anchor links, which meant the flow was
 * something you had to infer from scrolling — and it put a publish button on
 * the same screen as the first field, which is the ordering plan §14 is
 * explicit about getting the other way round.
 *
 * Steps are links, not a gated funnel: every one is reachable at any time. A
 * portfolio is not a checkout, the order is advice about what to do first, and
 * a user who wants to change their address before writing anything is not
 * making a mistake worth blocking.
 */
export function Steps({ siteId, current }: { siteId: string; current: StepId }) {
  return (
    <nav className="admin-steps" aria-label="Steps">
      {STEPS.map((step) => {
        const here = step.id === current;

        return (
          <a
            className={`admin-step${here ? ' is-here' : ''}`}
            href={stepHref(siteId, step.id)}
            key={step.id}
            aria-current={here ? 'step' : undefined}
          >
            <span className="admin-step-n">{step.n}</span>
            <span className="admin-step-title">{step.title}</span>
            <span className="admin-note">{step.note}</span>
          </a>
        );
      })}
    </nav>
  );
}

/**
 * Where to go next, and back. Rendered at the foot of a step, because that is
 * where someone is when they have finished one — making them scroll back up to
 * a nav to continue is the thing a wizard exists to avoid.
 */
export function StepNav({ siteId, current }: { siteId: string; current: StepId }) {
  const index = STEPS.findIndex((step) => step.id === current);
  const previous = STEPS[index - 1];
  const next = STEPS[index + 1];

  return (
    <div className="admin-stepnav">
      {previous ? (
        <a className="admin-button" href={stepHref(siteId, previous.id)}>
          ← {previous.title}
        </a>
      ) : (
        <span />
      )}

      {next ? (
        <a className="admin-button admin-primary" href={stepHref(siteId, next.id)}>
          {next.title} →
        </a>
      ) : null}
    </div>
  );
}
