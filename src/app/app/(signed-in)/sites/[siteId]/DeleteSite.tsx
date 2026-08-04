'use client';

import { useActionState } from 'react';

import { destroySite, type EditorState } from './actions';
import { Feedback } from './Feedback';

/**
 * Deleting a portfolio outright — the draft, every version it published, and
 * the address, which goes back into the pool.
 *
 * The owner types the thing they are destroying rather than clicking a button
 * that says "are you sure". A confirm dialog is dismissed by reflex; typing an
 * address is not. The server checks the same string, because a confirmation
 * only the browser enforces is decoration.
 */
export function DeleteSite({
  siteId,
  subdomain,
  publishedVersion,
}: {
  siteId: string;
  subdomain: string | null;
  publishedVersion: number | null;
}) {
  const [state, action, deleting] = useActionState<EditorState, FormData>(destroySite, {});

  // Mirrors `confirmationFor` on the server. An unnamed portfolio has no
  // address to type, so it gets a word.
  const phrase = subdomain ?? 'delete';

  return (
    <form action={action} className="admin-form">
      <input type="hidden" name="siteId" value={siteId} />

      <p className="admin-note">
        This removes the portfolio, its draft, and all {publishedVersion ?? 0} published{' '}
        {publishedVersion === 1 ? 'version' : 'versions'}. It cannot be undone
        {subdomain ? `, and ${subdomain} becomes available for someone else to claim` : ''}.
      </p>

      <label className="field">
        {/* The phrase is deliberately NOT in the label: `.field-label` is
            uppercased, so "type seanbrasse" rendered as "TYPE SEANBRASSE" and
            showed the wrong case for the thing being typed. It goes in the
            note, which is set in normal case. */}
        <span className="field-label">Confirm</span>
        <input name="confirm" autoComplete="off" spellCheck={false} required />
        <span className="admin-note">
          Type <code>{phrase}</code> to continue.
        </span>
      </label>

      <div className="admin-buttons">
        <button type="submit" className="admin-button admin-danger" disabled={deleting}>
          {deleting ? 'Deleting…' : 'Delete this portfolio'}
        </button>
      </div>

      <Feedback {...state} />
    </form>
  );
}
