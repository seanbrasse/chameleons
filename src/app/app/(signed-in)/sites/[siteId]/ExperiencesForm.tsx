'use client';

import { useState } from 'react';

import type { Experience } from '@/content/types';

import { ExperienceRow } from './ExperienceRow';

export function ExperiencesForm({
  siteId,
  experiences,
}: {
  siteId: string;
  experiences: Experience[];
}) {
  // Remounts the blank row on every successful add, which is what clears its
  // fields and gives it a fresh id — simpler than resetting form state by hand.
  const [addKey, setAddKey] = useState(0);

  return (
    <div className="admin-form">
      {experiences.map((experience) => (
        <ExperienceRow key={experience.id} siteId={siteId} experience={experience} />
      ))}

      <ExperienceRow
        key={addKey}
        siteId={siteId}
        experience={null}
        onCreated={() => setAddKey((k) => k + 1)}
      />
    </div>
  );
}
