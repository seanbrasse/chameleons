'use client';

import { useState, type MouseEvent } from 'react';

/**
 * A template preview that can be looked at at two widths.
 *
 * The frame renders the design at a real device width — 1280 for desktop, 390
 * for a phone — and scales that whole viewport down to fit the card, so the
 * preview shows the layout a visitor at that size would actually get, media
 * queries and all, rather than a desktop page squeezed narrow. Switching modes
 * animates the frame between the two widths (the iframe reflows live as it
 * narrows), which is the point: it shows the design *being* responsive, not a
 * claim that it is.
 *
 * The scaling itself is done in CSS with container-query units (see
 * `.admin-preview` in builder.css) so there is no measuring in JavaScript; this
 * component only owns which width is active and the control that flips it.
 */
function MonitorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="2.5" y="4" width="19" height="12.5" rx="1.5" />
      <path d="M9 20h6M12 16.5V20" strokeLinecap="round" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M11 18.5h2" strokeLinecap="round" />
    </svg>
  );
}

export function PreviewFrame({ src, title }: { src: string; title: string }) {
  const [mobile, setMobile] = useState(false);

  // The preview can sit inside a <label> that selects the design; a click on the
  // toggle must change the width and nothing else — not select the card, not
  // submit the form it lives in.
  const pick = (next: boolean) => (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setMobile(next);
  };

  return (
    <span className={`admin-preview${mobile ? ' is-mobile' : ''}`}>
      <span className="preview-modes" role="group" aria-label="Preview size">
        <button
          type="button"
          className="preview-mode"
          aria-label="Preview at desktop width"
          aria-pressed={!mobile}
          onClick={pick(false)}
        >
          <MonitorIcon />
        </button>
        <button
          type="button"
          className="preview-mode"
          aria-label="Preview at mobile width"
          aria-pressed={mobile}
          onClick={pick(true)}
        >
          <PhoneIcon />
        </button>
      </span>

      <iframe src={src} title={title} loading="lazy" tabIndex={-1} />
    </span>
  );
}
