'use client';

import dynamic from 'next/dynamic';

import type { Issue } from '@/content/types';

/**
 * Mounts the canvas builder client-only. The editor reads its opening layout
 * from `localStorage` in a state initialiser, so it must not server-render —
 * `ssr: false` keeps that read on the client and off the hydration path.
 */
const Editor = dynamic(() => import('@/components/editor/Editor').then((m) => m.Editor), {
  ssr: false,
});

export function TryClient({ issue }: { issue: Issue }) {
  return <Editor issue={issue} storageKey="chameleons.try.layout" />;
}
