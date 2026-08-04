'use client';

import { useActionState } from 'react';

import { publish, type EditorState } from './actions';
import { Feedback } from './Feedback';

/**
 * Publishes whatever is currently saved. Deliberately not tied to any one
 * section's form — with several independent sections on the page there is no
 * single "what's on screen" to resave, so this is honest about operating on
 * the persisted draft rather than quietly limited to whichever form happens
 * to submit it.
 */
export function PublishBar({ siteId }: { siteId: string }) {
  const [state, publishAction, publishing] = useActionState<EditorState, FormData>(publish, {});

  return (
    <div className="admin-actions">
      <form action={publishAction}>
        <input type="hidden" name="siteId" value={siteId} />
        <p className="admin-note">
          Publishes what you have already saved. Save each section above first.
        </p>
        <button type="submit" className="admin-button" disabled={publishing}>
          {publishing ? 'Publishing…' : 'Publish'}
        </button>
      </form>

      <Feedback {...state} />
    </div>
  );
}
