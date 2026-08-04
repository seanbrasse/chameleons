import type { ReactNode } from 'react';

import type { Issue } from '@/content/types';

/** An editor section: a heading, an optional count, and its fields. */
export function Section({
  title,
  id,
  aside,
  children,
}: {
  title: string;
  /** Anchors the rail's link for this section. */
  id: string;
  /** A count or short aside beside the heading. */
  aside?: string;
  children: ReactNode;
}) {
  return (
    <section className="admin-section" id={id}>
      {/* h3 inside a phase's h2, so the outline matches what the page looks
          like. When these were the page's only headings they were h2s. */}
      <div className="admin-section-head">
        <h3>{title}</h3>
        {aside ? <span className="admin-note">{aside}</span> : null}
      </div>
      {children}
    </section>
  );
}

/** Lower-case and plural, to read inside a sentence. */
export const PART_LABELS: Record<keyof Issue, string> = {
  settings: 'these settings',
  experiences: 'work history',
  projects: 'projects',
  education: 'education',
  testimonials: 'testimonials',
  metrics: 'metrics',
};

/** "testimonials and metrics", for the sentence on the kept group. */
export function listParts(parts: Array<keyof Issue>): string {
  const labels = parts.map((part) => PART_LABELS[part]);
  if (labels.length <= 2) return labels.join(' and ');
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}
