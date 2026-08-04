'use client';

import { useActionState } from 'react';

import type { OptionField } from '@/server/domain/template-options';

import { customize, type EditorState } from './actions';
import { Feedback } from './Feedback';

/**
 * The chosen template's own options, as a form rendered from its schema.
 *
 * `manifest.options` is a Zod schema and plan §6 says the builder renders its
 * form from it — so a template gains a control by declaring an option, not by
 * anyone editing this file. Every option `timeline` declares was previously
 * parsed, consumed by the component, and unreachable: every site sat on
 * defaults with no way to change them.
 */
export function Customize({
  siteId,
  templateId,
  fields,
  values,
}: {
  siteId: string;
  templateId: string;
  fields: OptionField[];
  /** Defaults merged with whatever the site overrode, so controls show truth. */
  values: Record<string, unknown>;
}) {
  const [state, action, saving] = useActionState<EditorState, FormData>(customize, {});

  const renderable = fields.filter((field) => field.kind !== 'unsupported');
  if (renderable.length === 0) {
    return <p className="admin-note">This design has nothing to adjust.</p>;
  }

  return (
    <form action={action} className="admin-form">
      <input type="hidden" name="siteId" value={siteId} />
      {/* The template the values belong to. Parsed against that template's
          schema server-side, so switching design mid-edit cannot write one
          template's options under another's name. */}
      <input type="hidden" name="templateId" value={templateId} />

      {renderable.map((field) =>
        field.kind === 'enum' ? (
          <label className="field" key={field.name}>
            <span className="field-label">{field.label}</span>
            <select name={field.name} defaultValue={String(values[field.name] ?? field.fallback)}>
              {field.values.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <span className="admin-note">{field.description}</span>
          </label>
        ) : (
          // `.admin-check` on its own, never combined with `.field` — the two
          // are different layouts and stacking them puts the box above its own
          // label. One span carrying the whole sentence, which is the shape the
          // stylesheet was written for. For a checkbox the sentence *is* the
          // label: "Show the career timeline under the work" says more than
          // "Show timeline" and a separate note.
          <label className="admin-check" key={field.name}>
            {/* Paired with a hidden field of the same name: an unchecked box
                sends nothing, and "nothing" has to mean false rather than
                "leave it as it was". The later value wins, so the server reads
                the last one rather than the first. */}
            <input type="hidden" name={field.name} value="false" />
            <input
              type="checkbox"
              name={field.name}
              value="true"
              defaultChecked={Boolean(values[field.name] ?? field.fallback)}
            />
            <span>{field.description || field.label}</span>
          </label>
        ),
      )}

      <div className="admin-buttons">
        <button type="submit" className="admin-button" disabled={saving}>
          {saving ? 'Saving…' : 'Save design options'}
        </button>
      </div>

      <Feedback {...state} />
    </form>
  );
}
