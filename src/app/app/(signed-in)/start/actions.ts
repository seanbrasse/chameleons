'use server';

import { revalidatePath } from 'next/cache';

import { builderRoute } from '@/server/domain/tenant';
import { draftProfileFrom } from '@/server/services/draftProfile';

export type IntakeState = {
  problem?: string;
  read?: { roles: number; schools: number; projects: number; gaps: string[] };
};

/**
 * The bytes arrive in the action and leave in the same request: read, extract,
 * discard (§23.6). Nothing is written to Storage, so none of the upload
 * pipeline applies — a file that is never served to a stranger needs no EXIF
 * strip, no quota and no MIME allowlist.
 */
export async function readDocument(_state: IntakeState, form: FormData): Promise<IntakeState> {
  const upload = form.get('file');
  const text = form.get('text');

  const file =
    upload instanceof File && upload.size > 0
      ? { name: upload.name, type: upload.type, bytes: await upload.arrayBuffer() }
      : undefined;

  const result = await draftProfileFrom({
    text: typeof text === 'string' ? text : undefined,
    file,
  });

  if (!result.ok) return { problem: result.reason };

  // The gallery previews read source material, so what was just read has to be
  // visible on the next screen.
  revalidatePath(builderRoute('/start'));
  revalidatePath(builderRoute('/new'));
  revalidatePath(builderRoute('/profile'));

  return { read: { ...result.counts, gaps: result.gaps } };
}
