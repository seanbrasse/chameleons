'use client';

import { useActionState } from 'react';

import { CAPS, type Experience, type Testimonial } from '@/content/types';

import {
  approveTestimonialRow,
  removeTestimonialRow,
  saveTestimonialRow,
  type EditorState,
} from './actions';
import { Feedback } from './Feedback';
import { ScopeFields, type EditScope } from './scope';
import { useBlankRow } from './useBlankRow';

export function TestimonialRow({
  scope,
  testimonial,
  employers,
}: {
  scope: EditScope;
  testimonial: Testimonial | null;
  employers: Experience[];
}) {
  const [saveState, saveAction, saving] = useActionState<EditorState, FormData>(
    saveTestimonialRow,
    {},
  );
  const [approveState, approveAction, approving] = useActionState<EditorState, FormData>(
    approveTestimonialRow,
    {},
  );
  const [removeState, removeAction, removing] = useActionState<EditorState, FormData>(
    removeTestimonialRow,
    {},
  );

  const { id, isNew, generation } = useBlankRow(testimonial?.id, saveState);

  return (
    // A row is closed until you want it. With three roles and four projects
    // every form open at once made the editor 11,000px of identical fields.
    // `details` rather than state: it works server-rendered, it is keyboard
    // and screen-reader native, and a row nobody opened costs nothing.
    <details className="admin-fieldset">
      <summary>{testimonial ? `${testimonial.authorName}${testimonial.approved ? '' : ' · pending'}` : 'Add a quote'}</summary>
      <form key={generation} action={saveAction} className="admin-form">
        <ScopeFields scope={scope} />
        <input type="hidden" name="testimonialId" value={id} />

        <label className="field">
          <span className="field-label">Quote</span>
          <textarea
            name="quote"
            rows={3}
            defaultValue={testimonial?.quote}
            maxLength={CAPS.quote}
            required
          />
        </label>

        <div className="admin-grid">
          <label className="field">
            <span className="field-label">Name</span>
            <input name="authorName" defaultValue={testimonial?.authorName} required />
          </label>

          <label className="field">
            <span className="field-label">Their role</span>
            <input name="authorRole" defaultValue={testimonial?.authorRole} />
          </label>

          <label className="field">
            <span className="field-label">Their company</span>
            <input name="authorCompany" defaultValue={testimonial?.authorCompany} />
          </label>

          <label className="field">
            <span className="field-label">Worked with you at</span>
            <select name="experienceId" defaultValue={testimonial?.experienceId ?? ''}>
              <option value="">Not linked</option>
              {employers.map((employer) => (
                <option key={employer.id} value={employer.id}>
                  {employer.company}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="admin-buttons">
          <button type="submit" className="admin-button" disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Add' : 'Save'}
          </button>
        </div>
      </form>

      {/* Approval is its own form. Editing someone else's words and deciding to
          show them are different acts, and one should never do the other. */}
      {testimonial !== null ? (
        <>
          <form action={approveAction} className="admin-buttons">
            <ScopeFields scope={scope} />
            <input type="hidden" name="testimonialId" value={id} />
            {testimonial.approved ? null : <input type="hidden" name="approved" value="on" />}
            <button
              type="submit"
              className={testimonial.approved ? 'admin-button admin-quiet' : 'admin-button'}
              disabled={approving}
            >
              {approving
                ? 'Saving…'
                : testimonial.approved
                  ? 'Approved — hide it'
                  : 'Approve for the live site'}
            </button>
          </form>

          <form action={removeAction} className="admin-buttons">
            <ScopeFields scope={scope} />
            <input type="hidden" name="testimonialId" value={id} />
            <button type="submit" className="admin-button admin-danger" disabled={removing}>
              {removing ? 'Removing…' : 'Remove'}
            </button>
          </form>
        </>
      ) : (
        <p className="admin-note">Added quotes stay hidden until you approve them.</p>
      )}

      <Feedback {...saveState} />
      <Feedback {...approveState} />
      <Feedback {...removeState} />
    </details>
  );
}
