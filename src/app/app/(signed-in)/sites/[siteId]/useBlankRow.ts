'use client';

import { useId, useState } from 'react';

import type { EditorState } from './actions';

/**
 * The identity and reset behaviour of an "add a row" form.
 *
 * This replaces `RowList`, which owned the same state one level up and took a
 * `render` function to reach the row. That could never work: `RowList` was a
 * client component and the editor page is a Server Component, so the function
 * had to cross the RSC boundary — which React refuses at runtime. Every list on
 * the page threw, and had done since the component was introduced. `build`
 * compiles it, `tsc` types it, and no test loads the editor because it needs a
 * session, so nothing caught it.
 *
 * Keeping the state in the row that uses it removes the boundary: only
 * serialisable props now cross from the page to a row.
 *
 * The reset has to change the *id*, not merely clear the fields. Blanking the
 * inputs while keeping the id would make the next add overwrite the row just
 * created, because the id is what `upsert` matches on.
 */
export function useBlankRow(existingId: string | undefined, saveState: EditorState) {
  const generatedId = useId();
  const [generation, setGeneration] = useState(0);

  // Adjusted during render rather than in an effect. `useActionState` hands
  // back a new object each time the action settles, so comparing identity is
  // what detects "a save just finished". An effect would work and is what this
  // started as, but setting state from one is a cascading render — React's own
  // guidance is to derive it here, where the re-render happens before paint.
  const [seen, setSeen] = useState(saveState);
  const isNew = existingId === undefined;

  if (seen !== saveState) {
    setSeen(saveState);
    if (isNew && saveState.saved) setGeneration((current) => current + 1);
  }

  return {
    id: existingId ?? `${generatedId}-${generation}`,
    isNew,
    /** Key the form on this, so a successful add remounts and clears it. */
    generation,
  };
}
