-- The media bucket: where a project's images and videos are stored.
--
-- Public-read, service-role-write, to match the app's model (plan §2). A
-- published portfolio is anonymous, so its images have to load without a
-- session — the same reason the bucket is public. Writes never come from a
-- browser: only the server tier, through the service role, uploads here, so
-- there are no insert/update/delete policies on storage.objects, exactly as the
-- application tables carry none. Objects live under an unguessable path,
-- media/<site_id>/<asset_id>.<ext>, so a draft's images are effectively unlisted
-- until the site is published.
--
-- The size limit and MIME allowlist are a coarse backstop *behind* the app's
-- own gate (server/domain/upload.ts), which enforces the real per-kind limits,
-- sniffs the actual bytes, bans SVG, and strips EXIF before anything is stored.
--
-- Idempotent: this is applied to the live project via the Supabase MCP, and is
-- written to no-op if the deploy pipeline runs it again.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  52428800, -- 50 MiB
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
