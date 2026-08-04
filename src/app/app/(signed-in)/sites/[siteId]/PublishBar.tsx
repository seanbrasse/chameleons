'use client';

import { useActionState } from 'react';

import { claimAddressAction, publish, unpublish, type EditorState } from './actions';
import { Feedback } from './Feedback';

/**
 * Publishing is the last step, so the address is asked for here rather than
 * before anything has been written. Once claimed, the same form renames.
 *
 * Publish operates on the saved draft and does not resave any section's
 * on-screen fields — with several independent forms on the page there is no
 * single "what's on screen" to carry, and pretending otherwise would silently
 * skip whichever section did not submit.
 */
export function PublishBar({
  siteId,
  subdomain,
  suffix,
  publishedVersion,
  previewHref,
}: {
  siteId: string;
  subdomain: string | null;
  suffix: string;
  publishedVersion: number | null;
  previewHref: string;
}) {
  const [addressState, addressAction, claiming] = useActionState<EditorState, FormData>(
    claimAddressAction,
    {},
  );
  const [publishState, publishAction, publishing] = useActionState<EditorState, FormData>(
    publish,
    {},
  );
  const [offState, offAction, takingOff] = useActionState<EditorState, FormData>(unpublish, {});

  const live = publishedVersion !== null;

  return (
    <section>
      <h2>Publish</h2>

      <form action={addressAction} className="admin-form">
        <input type="hidden" name="siteId" value={siteId} />
        <label className="field">
          <span className="field-label">{subdomain ? 'Address' : 'Choose an address'}</span>
          <input
            name="subdomain"
            defaultValue={subdomain ?? ''}
            required
            autoComplete="off"
            spellCheck={false}
            placeholder="yourname"
          />
          <span className="admin-note">
            Your portfolio will be read at <code>{subdomain || 'yourname'}{suffix}</code>.
          </span>
        </label>

        <div className="admin-buttons">
          <button type="submit" className="admin-button admin-quiet" disabled={claiming}>
            {claiming ? 'Saving…' : subdomain ? 'Rename' : 'Claim it'}
          </button>
        </div>
      </form>

      <Feedback {...addressState} />

      <div className="admin-actions">
        {/* A link, not a button: opening the draft in its own tab is what makes
            it comparable with the live site, and leaves the editor untouched. */}
        <a className="admin-button admin-quiet" href={previewHref} target="_blank" rel="noreferrer">
          Preview
        </a>

        <form action={publishAction}>
          <input type="hidden" name="siteId" value={siteId} />
          <button type="submit" className="admin-button" disabled={publishing || !subdomain}>
            {publishing ? 'Publishing…' : live ? 'Publish changes' : 'Publish'}
          </button>
        </form>

        {live ? (
          <form action={offAction}>
            <input type="hidden" name="siteId" value={siteId} />
            <button type="submit" className="admin-button admin-danger" disabled={takingOff}>
              {takingOff ? 'Taking it down…' : 'Unpublish'}
            </button>
          </form>
        ) : null}
      </div>

      {!subdomain ? (
        <p className="admin-note">Claim an address first. Publishing needs somewhere to serve.</p>
      ) : (
        <p className="admin-note">Publishes what you have already saved.</p>
      )}

      <Feedback {...publishState} />
      <Feedback {...offState} />
    </section>
  );
}
