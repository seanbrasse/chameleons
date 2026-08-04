import type { ReactNode } from 'react';

import type { Issue } from '@/content/types';

/**
 * An editor section, plus an honest note when the chosen design will not render
 * it.
 *
 * `manifest.uses` has existed since the template contract was written and was
 * read by nothing, which made it a comment rather than a feature. Meanwhile
 * `timeline` shows neither testimonials nor metrics, and the builder offered
 * editors for both — so a user could write a page of quotes that their live
 * site silently discarded, with no way to find out except publishing and
 * looking.
 *
 * The note says "not shown", never "delete this". Content lives in the `Issue`
 * and survives a template switch, so it is genuinely kept — it is the design
 * that is not asking for it, and that is a reason to mention the other designs
 * rather than to hide the fields.
 */
export function Section({
  title,
  part,
  uses,
  templateName,
  id,
  aside,
  children,
}: {
  title: string;
  /** How to name this content mid-sentence — "metrics", "testimonials". */
  part: keyof Issue;
  /** Null when the site names a template this build does not ship. */
  uses: Array<keyof Issue> | null;
  templateName: string;
  /** Anchors the rail's link for this section. */
  id: string;
  /** A count or short aside beside the heading. */
  aside?: string;
  children: ReactNode;
}) {
  // No manifest means no claim either way. Say nothing rather than guess: a
  // wrong "this is not shown" is worse than a missing one.
  const shown = uses === null || uses.includes(part);

  return (
    <section className="admin-section" id={id}>
      {/* h3 inside a phase's h2, so the outline matches what the page looks
          like. When these were the page's only headings they were h2s. */}
      <div className="admin-section-head">
        <h3>{title}</h3>
        {aside ? <span className="admin-note">{aside}</span> : null}
      </div>
      {shown ? null : (
        <p className="admin-note">
          {templateName} does not show {LABELS[part]}. What you write here is kept, and appears if
          you switch to a design that uses it.
        </p>
      )}
      {children}
    </section>
  );
}

/** Lower-case and plural, to read inside the sentence above. */
const LABELS: Record<keyof Issue, string> = {
  settings: 'these settings',
  experiences: 'work history',
  projects: 'projects',
  education: 'education',
  testimonials: 'testimonials',
  metrics: 'metrics',
};
