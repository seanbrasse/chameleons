import type { ReactNode } from 'react';

/**
 * One of the three stages of the flow.
 *
 * Design, content, publish. Previously all eight sections were peer `h2`s, so
 * Publish — the point of the page — carried exactly the weight of Delete, and
 * nothing said which one finishes the job.
 */
export function Phase({
  n,
  title,
  note,
  children,
}: {
  n: string;
  title: string;
  /** What the stage is for, right-aligned. Short enough to read in passing. */
  note?: string;
  children: ReactNode;
}) {
  return (
    <div className="admin-phase">
      <div className="admin-phase-head">
        <span className="admin-phase-n">{n}</span>
        <h2>{title}</h2>
        {note ? <span className="admin-phase-note">{note}</span> : null}
      </div>
      {children}
    </div>
  );
}
