'use client';

import { useCallback, useSyncExternalStore } from 'react';

import { DEFAULT_THEME, type Theme } from './tokens';

/** A year, so the choice sticks like a preference rather than a session. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * The theme is owned by the document, not by React — `ThemeScript` sets
 * `data-theme` before first paint so there is no flash. Reading it with
 * `useSyncExternalStore` means React never holds a second copy that could
 * disagree with the attribute, and the server render has no opinion at all.
 */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

function readTheme(): Theme {
  // Only `dark` is read as an explicit switch away from the default, so this is
  // correct whichever theme `DEFAULT_THEME` is — reading for `light` instead
  // would report the default for a `dark` attribute once light became default.
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : DEFAULT_THEME;
}

export function ThemeToggle() {
  // The server has no document, so it renders the default. The script has
  // already corrected the attribute by the time this hydrates.
  const theme = useSyncExternalStore(subscribe, readTheme, () => DEFAULT_THEME);

  const toggle = useCallback(() => {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    // Stored in a cookie so the choice sticks across visits and is a preference
    // the server could read too. `ThemeScript` reads it back before first paint.
    document.cookie = `theme=${next}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
  }, [theme]);

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-pressed={theme === 'dark'}
    >
      <span className="theme-toggle-dot" aria-hidden="true" />
      {theme === 'dark' ? 'Dark' : 'Light'}
    </button>
  );
}
