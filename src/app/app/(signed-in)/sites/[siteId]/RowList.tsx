'use client';

import { useState, type ReactNode } from 'react';

/**
 * A list of saved rows plus one blank row that adds another. Extracted at the
 * third identical use (experience, project, education) rather than guessed at
 * the first.
 *
 * The subtle part is the blank row's key: bumping it on a successful add
 * remounts that row, which is what clears its fields and gives it a fresh id.
 * Resetting the fields by hand instead would leave the id behind and the next
 * "add" would overwrite the row just created.
 */
export function RowList<T extends { id: string }>({
  items,
  render,
}: {
  items: T[];
  render: (item: T | null, onCreated?: () => void) => ReactNode;
}) {
  const [addKey, setAddKey] = useState(0);

  return (
    <div className="admin-form">
      {items.map((item) => (
        <div key={item.id}>{render(item)}</div>
      ))}
      <div key={`add-${addKey}`}>{render(null, () => setAddKey((k) => k + 1))}</div>
    </div>
  );
}
