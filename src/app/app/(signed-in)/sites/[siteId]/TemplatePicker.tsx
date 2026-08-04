'use client';

import { useActionState } from 'react';

import { chooseTemplateAction, type EditorState } from './actions';
import { Feedback } from './Feedback';

export type TemplateChoice = {
  id: string;
  name: string;
  description: string;
  constraint: string;
};

/**
 * Picking the design is step two of the flow, before the content, because the
 * design decides what content is worth entering.
 *
 * Each option shows its `constraint` as well as its description. The constraint
 * is the thing that actually distinguishes one template from another — "does
 * not scroll on a desktop viewport" tells you more about whether it suits your
 * work than any adjective would.
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

  const onlyOne = templates.length < 2;

  return (
    <form action={action} className="admin-form">
      <input type="hidden" name="siteId" value={siteId} />

      <ul className="admin-list">
        {templates.map((template) => (
          <li key={template.id} className="admin-fieldset">
            <label className="admin-check">
              <input
                type="radio"
                name="templateId"
                value={template.id}
                defaultChecked={template.id === selectedId}
              />
              <span>{template.name}</span>
            </label>
            <p className="admin-note">{template.description}</p>
            <p className="admin-note">
              <strong>Its rule:</strong> {template.constraint}
            </p>
          </li>
        ))}
      </ul>

      {onlyOne ? (
        <p className="admin-note">
          One design so far. Switching between them keeps your content — it is the
          same portfolio rendered differently.
        </p>
      ) : (
        <div className="admin-buttons">
          <button type="submit" className="admin-button admin-quiet" disabled={saving}>
            {saving ? 'Switching…' : 'Use this design'}
          </button>
        </div>
      )}

      <Feedback {...state} />
    </form>
  );
}
