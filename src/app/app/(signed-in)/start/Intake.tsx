'use client';

import { useActionState, useRef, useState } from 'react';

import { readDocument, type IntakeState } from './actions';

/**
 * The document box.
 *
 * A file or some pasted text goes to Claude, which records what the source
 * actually says into the person's own content. It is one call against one tool
 * schema covering every field at once — the schema *is* the mapping, so there
 * is no per-field API and nothing to keep in step as fields are added.
 *
 * What comes back is deliberately incomplete. The model transcribes and never
 * infers (§23.5), so anything the document did not state arrives empty and is
 * reported as a gap rather than filled with something plausible. A résumé that
 * claims no numbers produces no numbers.
 */
export function Intake({ enabled }: { enabled: boolean }) {
  const [state, act, pending] = useActionState<IntakeState, FormData>(readDocument, {});
  const [fileName, setFileName] = useState('');
  const input = useRef<HTMLInputElement>(null);

  if (!enabled) {
    return (
      <p className="admin-note" role="status">
        Reading documents is not switched on for this deployment yet. Import from GitHub below, or
        type your details in — nothing here is blocked by it.
      </p>
    );
  }

  return (
    <form action={act} className="admin-form">
      <label className="field">
        <span className="field-label">A résumé, CV, or write-up</span>
        <input
          ref={input}
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
        <textarea
          name="text"
          rows={5}
          placeholder="A bio, a list of roles, notes about a project…"
        />
      </label>

      <div className="admin-buttons">
        <button type="submit" className="admin-button admin-primary" disabled={pending}>
          {pending ? 'Reading…' : 'Read this'}
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
            Read {state.read.roles} roles, {state.read.schools} schools and {state.read.projects}{' '}
            projects into your content.
          </p>

          {/* Named, not silently left blank. These are the fields no document
              states, and the person is the only source for them. */}
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
