'use client';

import { useActionState } from 'react';

import { rollback, type EditorState } from './actions';
import { Feedback } from './Feedback';

export type HistoryEntry = {
  version: number;
  publishedAt: string;
  templateId: string;
};

/**
 * Every version this site has published, newest first, with the live one
 * flagged.
 *
 * Close to free by construction: publishing already writes an immutable
 * snapshot and keeps it, and rolling back is the same pointer move publishing
 * makes (§4). Until now nothing could see any of it.
 */
export function History({
  siteId,
  entries,
  liveVersion,
}: {
  siteId: string;
  entries: HistoryEntry[];
  liveVersion: number | null;
}) {
  const [state, action, working] = useActionState<EditorState, FormData>(rollback, {});

  if (entries.length === 0) {
    return <p className="admin-note">Nothing published yet. Versions appear here once you do.</p>;
  }

  return (
    <>
      {/* Said plainly because the opposite is the scary reading: someone
          restoring last month's site must not fear it discards this morning's
          writing. Rollback moves the pointer and never touches the draft. */}
      <p className="admin-note">
        Rolling back changes what visitors see. It does not change what you are editing — your draft
        stays as it is, and publishing again puts it back.
      </p>

      <ul className="admin-list admin-list-linear">
        {entries.map((entry) => {
          const live = entry.version === liveVersion;

          return (
            <li key={entry.version}>
              <div className="admin-row">
                <span className="admin-row-main">
                  <strong>Version {entry.version}</strong>
                  <span className="admin-note">
                    {/* A client component still server-renders, and the server
                        formats in its own locale and timezone — so this text
                        genuinely differs between the two passes. Suppressed
                        rather than worked around: the value that matters is
                        `dateTime`, and the client's rendering is the correct
                        one because it is the reader's own clock. */}
                    <time dateTime={entry.publishedAt} suppressHydrationWarning>
                      {formatted(entry.publishedAt)}
                    </time>{' '}
                    · {entry.templateId}
                  </span>
                </span>

                {live ? (
                  <span className="admin-flag admin-flag-live">Live</span>
                ) : (
                  <form action={action} className="admin-row-action">
                    <input type="hidden" name="siteId" value={siteId} />
                    <input type="hidden" name="version" value={entry.version} />
                    <button type="submit" className="admin-button admin-quiet" disabled={working}>
                      {working ? 'Working…' : 'Make live'}
                    </button>
                  </form>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Feedback {...state} />
    </>
  );
}

/** Falls back to the raw ISO string rather than rendering "Invalid Date". */
function formatted(iso: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime())
    ? iso
    : at.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
