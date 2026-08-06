'use client';

import { useSyncExternalStore } from 'react';

/**
 * Flips `data-theme` and stores the choice in the `theme` cookie the
 * `ThemeScript` reads next load. State is read from the attribute the script
 * already set, via `useSyncExternalStore` over a `MutationObserver`, so there is
 * no second source of truth and no setState-in-effect. Plain sans text, not a
 * switch — this design does not do chrome.
 */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  return () => observer.disconnect();
}

function getSnapshot(): 'light' | 'dark' {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => 'light');

  function toggle() {
    const next = theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-pressed={theme === 'dark'}>
      {theme === 'dark' ? 'Dark' : 'Light'}
    </button>
  );
}
