'use client';

import { useActionState, useState } from 'react';

import { PreviewFrame } from '../../PreviewFrame';
import { TemplateTags } from '../../TemplateTags';
import { useTemplateBrowser, type BrowsableTemplate } from '../../TemplateBrowser';
import { chooseTemplateAction, type EditorState } from './actions';
import { Feedback } from './Feedback';

export type TemplateChoice = BrowsableTemplate;

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

  const { visible, controls } = useTemplateBrowser(templates);

  return (
    <form action={action} className="admin-form admin-form-wide">
      <input type="hidden" name="siteId" value={siteId} />

      {controls}

      {visible.length === 0 ? (
        <p className="admin-note" role="status">
          No design matches those filters. Clear one to see more.
        </p>
      ) : null}

      <div className="admin-gallery">
        {visible.map((template) => (
          <div
            className={`admin-gallery-item admin-choice${chosen === template.id ? ' is-chosen' : ''}`}
            key={template.id}
          >
            {/* The label wraps the preview, so clicking the design picks it —
                which is what a card invites you to do. The preview's own size
                toggle is a button, so it changes the width without selecting. */}
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

              <PreviewFrame
                src={`/app/preview/${siteId}?template=${template.id}&embed=1`}
                title={`${template.name}, showing your content`}
              />
            </label>

            <TemplateTags attributes={template.attributes} />
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
