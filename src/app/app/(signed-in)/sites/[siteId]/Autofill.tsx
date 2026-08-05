'use client';

import { useActionState, useRef, useState } from 'react';

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
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function takeFile(files: FileList | null) {
    setFileName(files?.[0]?.name ?? '');
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files;
    if (dropped.length && fileInput.current) {
      // Hand the dropped file to the real input so the Server Action submits it
      // with the form — no separate upload path, and the bytes still leave in
      // the one request (§23.6).
      fileInput.current.files = dropped;
      takeFile(dropped);
    }
  }

  return (
    <form action={act} className="admin-form admin-form-wide">
      <ScopeFields scope={scope} />

      {/* Always shown, drop or click. A résumé is the fastest way to fill this,
          so the box says so rather than hiding behind a disclosure. */}
      <div
        className={`admin-dropzone${dragging ? ' is-dragging' : ''}${enabled ? '' : ' is-off'}`}
        onDragOver={(event) => {
          if (!enabled) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={enabled ? onDrop : undefined}
        onClick={() => enabled && fileInput.current?.click()}
      >
        <input
          ref={fileInput}
          type="file"
          name="file"
          accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
          hidden
          disabled={!enabled}
          onChange={(event) => takeFile(event.target.files)}
        />

        <p className="admin-dropzone-lead">
          {fileName ? fileName : 'Drop a résumé or CV here, or click to choose one'}
        </p>
        <p className="admin-note">
          PDF or plain text, up to 4MB. Read once and discarded — the file itself is never stored.
        </p>
      </div>

      <label className="field">
        <span className="field-label">Or paste anything about your work</span>
        <textarea
          name="text"
          rows={5}
          disabled={!enabled}
          placeholder="A bio, a list of roles, a write-up of a project — whatever you have."
        />
      </label>

      {enabled ? (
        <div className="admin-buttons">
          <button type="submit" className="admin-button admin-primary" disabled={pending}>
            {pending ? 'Reading…' : 'Fill the fields from this'}
          </button>
        </div>
      ) : (
        // Sean owns the deployment, so tell him exactly how to switch it on
        // rather than showing a dead "not available" that reads as broken.
        <p className="admin-note" role="status">
          Reading documents needs an <code>ANTHROPIC_API_KEY</code> on the deployment. Set one in
          the Vercel project to switch this on. Until then, import from GitHub below or type your
          details in — nothing else is blocked.
        </p>
      )}

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
