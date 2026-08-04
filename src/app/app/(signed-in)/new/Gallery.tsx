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
 * The viewport each preview is rendered at before being scaled down. Template #1
 * is built not to scroll at a desktop size, so a preview narrower than this
 * would show a design nobody will ever see.
 */
const PREVIEW_WIDTH = 1280;
const PREVIEW_HEIGHT = 800;

/**
 * The first screen of a new account.
 *
 * It shows the designs rather than describing them. A list of names and
 * adjectives is a menu, not a picker — plan §23.2 asks for the user's own work
 * rendered in each design, so each card is the real template running against
 * their imported content in an iframe.
 *
 * An iframe rather than an inline render, because a template owns its whole
 * page: its stylesheet sets custom properties on `:root` and its CSS is written
 * against a document it controls. Three of those composed into one builder page
 * would have three designs fighting over the same cascade.
 *
 * Picking before you have content is still picking somewhat blind, and what
 * makes that acceptable rather than a coin toss is that switching is free:
 * template changes preserve every `Issue` field and the customization alongside
 * it. The gallery says so outright, because a user who believes the choice is
 * permanent will stall on it, and stalling on screen one is worse than starting
 * on the wrong design.
 */
export function Gallery({
  templates,
  backHref,
  hasContent,
}: {
  templates: GalleryTemplate[];
  /** Null for an account with no sites — there is no list to go back to. */
  backHref: string | null;
  /** False when the previews are showing sample content instead of the user's. */
  hasContent: boolean;
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

            <div className="admin-preview">
              {/* Inert: the frame is a picture of the design, and a click
                  anywhere on the card should choose it rather than land inside
                  a nested page. `tabindex=-1` keeps the preview out of the tab
                  order for the same reason. */}
              <iframe
                src={`/app/preview/template/${template.id}`}
                title={`${template.name}, previewed with your content`}
                loading="lazy"
                tabIndex={-1}
                width={PREVIEW_WIDTH}
                height={PREVIEW_HEIGHT}
              />
            </div>

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
        {hasContent
          ? 'Each preview is your own imported content, rendered by that design.'
          : 'The previews use sample content until you import your own — a blank portfolio looks the same in every design.'}{' '}
        You can switch design at any time, and your content comes with you, so nothing you write is
        tied to this choice.
      </p>

      {backHref ? (
        <p className="admin-note">
          <a href={backHref}>Back to your portfolios</a>
        </p>
      ) : null}
    </>
  );
}
