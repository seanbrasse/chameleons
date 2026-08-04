'use client';

import { useActionState } from 'react';

import { startPortfolio, type NewSiteState } from '../actions';

export type GalleryTemplate = {
  id: string;
  name: string;
  description: string;
  constraint: string;
};

/**
 * The first screen of a new account.
 *
 * Picking before you have content is picking blind — §6's argument is that a
 * good picker renders *your* work in each design, and at first run there is
 * none. What makes that acceptable rather than a coin toss is that switching is
 * free: template changes preserve every `Issue` field and the customization
 * alongside it. So the gallery says so outright, because a user who believes
 * the choice is permanent will stall on it, and stalling on screen one is worse
 * than starting on the wrong design.
 */
export function Gallery({
  templates,
  backHref,
}: {
  templates: GalleryTemplate[];
  /** Null for an account with no sites — there is no list to go back to. */
  backHref: string | null;
}) {
  const [state, action, pending] = useActionState<NewSiteState, FormData>(startPortfolio, {});

  return (
    <>
      {state.problem ? (
        <p className="admin-error" role="status">
          {state.problem}
        </p>
      ) : null}

      <div className="admin-gallery">
        {templates.map((template) => (
          <form action={action} key={template.id} className="admin-gallery-item">
            <input type="hidden" name="templateId" value={template.id} />

            <h2>{template.name}</h2>
            <p className="admin-note">{template.description}</p>

            {/* The constraint, not an adjective. It is what actually separates
                one design from another — "does not scroll on a desktop
                viewport" tells you whether it suits your work; "clean and
                modern" tells you nothing (§20.5). */}
            <p className="admin-note">
              <strong>Its rule:</strong> {template.constraint}
            </p>

            <div className="admin-buttons">
              <button type="submit" className="admin-button admin-primary" disabled={pending}>
                {pending ? 'Starting…' : `Start with ${template.name}`}
              </button>
            </div>
          </form>
        ))}
      </div>

      <p className="admin-note">
        You can switch design at any time — your content comes with you, so nothing you write here
        is tied to this choice.
      </p>

      {backHref ? (
        <p className="admin-note">
          <a href={backHref}>Back to your portfolios</a>
        </p>
      ) : null}
    </>
  );
}
