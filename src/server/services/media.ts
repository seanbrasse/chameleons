import 'server-only';

import type { Asset } from '@/content/types';
import { hasServiceRole, supabaseService } from '@/lib/supabase/service';
import { imageDimensions } from '@/server/domain/image-metadata';
import { prepareUpload } from '@/server/domain/upload';

/**
 * The one place that moves bytes to storage.
 *
 * Everything a file must pass — the type allowlist, the SVG ban, the size caps,
 * the site quota, and the EXIF strip — is decided by `prepareUpload` (pure,
 * unit-tested) before a single byte reaches the bucket. This module is the thin
 * shell around that decision: read what the site already stores, ask
 * `prepareUpload`, and on a yes upload the *stripped* bytes and hand back the
 * `Asset` the template will render.
 *
 * The bucket is public-read and service-role-write (migration `0009`): a
 * published portfolio's images have to load for an anonymous visitor, and the
 * browser never writes to storage — only this does, through the service role,
 * which is why the path is scoped by the caller (`services/editSite.ts` proves
 * ownership before it calls in).
 */
const BUCKET = 'media';

export type MediaUpload = { ok: true; asset: Asset } | { ok: false; message: string };

/** Bytes already stored under a prefix, so the quota counts a site's own usage. */
async function usedBytes(prefix: string): Promise<number> {
  const { data, error } = await supabaseService()
    .storage.from(BUCKET)
    .list(prefix, { limit: 1000 });

  if (error || !data) return 0;
  return data.reduce((sum, object) => sum + (object.metadata?.size ?? 0), 0);
}

export async function uploadMedia(prefix: string, fileBytes: ArrayBuffer): Promise<MediaUpload> {
  if (!hasServiceRole()) {
    return { ok: false, message: 'Uploads are not switched on for this deployment.' };
  }

  const bytes = new Uint8Array(fileBytes);
  const prepared = prepareUpload(bytes, await usedBytes(prefix));
  if (!prepared.ok) return { ok: false, message: prepared.refusal.message };

  const { type } = prepared;
  const id = crypto.randomUUID();
  const path = `${prefix}/${id}.${type.extension}`;

  const { error } = await supabaseService()
    .storage.from(BUCKET)
    .upload(path, prepared.bytes, { contentType: type.mime, upsert: false });

  if (error) return { ok: false, message: 'That upload could not be saved. Try again.' };

  const { data } = supabaseService().storage.from(BUCKET).getPublicUrl(path);
  const dimensions = imageDimensions(prepared.bytes, type.mime);

  return {
    ok: true,
    asset: {
      id,
      src: data.publicUrl,
      alt: '',
      width: dimensions?.width ?? 0,
      height: dimensions?.height ?? 0,
      kind: 'screenshot',
      media: type.kind === 'video' ? 'video' : 'image',
    },
  };
}

/**
 * Removes a stored object by the public URL a row pointed at, best-effort. The
 * row is updated first (the person's edit must not wait on storage); a failed
 * reap leaves an orphan for the version-media sweep, never a broken page.
 */
export async function deleteMedia(src: string): Promise<void> {
  if (!hasServiceRole()) return;

  const marker = `/object/public/${BUCKET}/`;
  const at = src.indexOf(marker);
  if (at === -1) return;

  await supabaseService()
    .storage.from(BUCKET)
    .remove([src.slice(at + marker.length)]);
}
