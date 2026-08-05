'use client';

import { useActionState, useState } from 'react';

import { chooseTemplateAction, type EditorState } from './actions';
import { Feedback } from './Feedback';

export type TemplateChoice = {
  id: string;
  name: string;
  description: string;
  constraint: string;
};

/** The size each preview renders at before being scaled into its card. */
const PREVIEW_WIDTH = 1280;
const PREVIEW_HEIGHT = 800;

/**
 * Picking the design is the first step of the flow, because the design decides
 * what content is worth entering.
 *
 * Each choice is a card showing **this portfolio's own content** rendered by
 * that design, not a name and a paragraph. A description cannot tell you
 * whether a template suits your work; seeing your projects in it can. The
 * preview route renders a candidate template without saving anything, so
 * looking costs nothing and changing your mind costs nothing.
 *
 * The constraint stays alongside, because it is the one sentence that survives
 * being read rather than looked at — "does not scroll on a desktop viewport"
 * tells you something no adjective does (§20.5).
 */
export function TemplatePicker({
  siteId,
  templates,
  selectedId,
}: {
  siteId: string;
  templates: TemplateChoice[];
  selectedId: string;
}) {
  const [state, action, saving] = useActionState<EditorState, FormData>(
    chooseTemplateAction,
    {},
  );

  // Held here so a card reads as chosen the moment it is clicked rather than
  // after the round trip. The radio is still what the submit sends.
  const [chosen, setChosen] = useState(selectedId);

  return (
    <form action={action} className="admin-form admin-form-wide">
      <input type="hidden" name="siteId" value={siteId} />

      <div className="admin-gallery">
        {templates.map((template) => (
          <div
            className={`admin-gallery-item admin-choice${chosen === template.id ? ' is-chosen' : ''}`}
            key={template.id}
          >
            {/* The label wraps the preview, so clicking the design picks it —
                which is what a card invites you to do. */}
            <label className="admin-choice-label">
              <span className="admin-choice-head">
                <input
                  type="radio"
                  name="templateId"
                  value={template.id}
                  checked={chosen === template.id}
                  onChange={() => setChosen(template.id)}
                />
                <span className="admin-choice-name">{template.name}</span>
                {template.id === selectedId ? (
                  <span className="admin-note">in use</span>
                ) : null}
              </span>

              <span className="admin-preview">
                <iframe
                  src={`/app/preview/${siteId}?template=${template.id}&embed=1`}
                  title={`${template.name}, showing your content`}
                  loading="lazy"
                  tabIndex={-1}
                  width={PREVIEW_WIDTH}
                  height={PREVIEW_HEIGHT}
                />
              </span>
            </label>

            <p className="admin-note">{template.description}</p>
            <p className="admin-note">
              <strong>Its rule:</strong> {template.constraint}
            </p>

            {/* A new tab rather than a panel: the preview is a whole page at its
                own width, and a design built for 1280px cannot be judged in a
                column beside the builder. */}
            <p className="admin-note">
              <a
                href={`/app/preview/${siteId}?template=${template.id}`}
                target="_blank"
                rel="noreferrer"
              >
                Open {template.name} full size ↗
              </a>
            </p>
          </div>
        ))}
      </div>

      <div className="admin-buttons">
        <button
          type="submit"
          className="admin-button admin-primary"
          disabled={saving || chosen === selectedId}
        >
          {saving ? 'Switching…' : chosen === selectedId ? 'This design is in use' : 'Use this design'}
        </button>
      </div>

      <p className="admin-note">
        Switching keeps every word you have written — it is the same portfolio rendered differently.
      </p>

      <Feedback {...state} />
    </form>
  );
}
