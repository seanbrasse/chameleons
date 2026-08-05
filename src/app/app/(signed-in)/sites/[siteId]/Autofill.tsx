'use client';

import { useActionState, useState } from 'react';

import { autofill, type AutofillState } from './actions';
import { ScopeFields, type EditScope } from './scope';

/**
 * Drop a résumé, paste a write-up, and have the fields fill themselves.
 *
 * This is the convenience the whole builder is for: the original portfolio let
 * you paste a doc and Claude mapped it onto the form, and this is that, scoped
 * to whatever is being edited. One forced tool call maps the source onto the
 * `Issue` — the schema *is* the mapping — and the result **merges** into what is
 * already there, so running it on a half-filled editor updates matching rows and
 * leaves everything else, including anything hand-typed, alone.
 *
 * It transcribes and never infers (§23.5). Anything the document does not state
 * comes back empty and is reported as a gap rather than invented — a portfolio
 * with a claim the person never made is worse than one with a blank to fill.
 */
export function Autofill({ scope, enabled }: { scope: EditScope; enabled: boolean }) {
  const [state, act, pending] = useActionState<AutofillState, FormData>(autofill, {});
  const [fileName, setFileName] = useState('');

  if (!enabled) {
    return (
      <p className="admin-note" role="status">
        Filling fields from a document is not switched on for this deployment yet. You can still
        import from GitHub, or type your details in below.
      </p>
    );
  }

  return (
    <form action={act} className="admin-form">
      <ScopeFields scope={scope} />

      <label className="field">
        <span className="field-label">A résumé, CV, or write-up</span>
        <input
          type="file"
          name="file"
          accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
          onChange={(event) => setFileName(event.target.files?.[0]?.name ?? '')}
        />
        <span className="admin-note">
          PDF or plain text, up to 4MB. It is read and discarded — the file itself is never stored.
        </span>
      </label>

      <label className="field">
        <span className="field-label">Or paste anything about your work</span>
        <textarea name="text" rows={4} placeholder="A bio, a list of roles, notes about a project…" />
      </label>

      <div className="admin-buttons">
        <button type="submit" className="admin-button admin-primary" disabled={pending}>
          {pending ? 'Reading…' : 'Fill the fields from this'}
        </button>
        {fileName ? <span className="admin-note">{fileName}</span> : null}
      </div>

      {state.problem ? (
        <p className="admin-error" role="status">
          {state.problem}
        </p>
      ) : null}

      {state.read ? (
        <div role="status">
          <p className="admin-note">
            Filled {state.read.roles} roles, {state.read.schools} schools and{' '}
            {state.read.projects} projects. Existing entries were updated, not replaced — review
            them below.
          </p>

          {/* The fields no document states, named rather than left silently
              blank. Impact, seniority and outcomes are the person's to write. */}
          {state.read.gaps.length > 0 ? (
            <p className="admin-note">
              <strong>Still yours to write:</strong> {state.read.gaps.join('; ')}. Nothing was
              invented to fill them.
            </p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
