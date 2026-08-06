'use client';

import { useActionState } from 'react';

import type { Asset } from '@/content/types';

import { removeProjectImageRow, uploadProjectImageRow, type EditorState } from './actions';
import { Feedback } from './Feedback';
import { ScopeFields, type EditScope } from './scope';

/**
 * A project's images, on the row that owns it.
 *
 * Only shown once the project exists, because an upload has to land on a saved
 * row's id. The file leaves the browser to a server action; the media service
 * strips its metadata and checks it against the quota before it is stored, so
 * nothing here is trusted — this is only the picker and the gallery of what came
 * back. Upload and remove are separate forms with their own pending state, like
 * every other add/remove pair in the editor.
 */
export function ProjectImages({
  scope,
  projectId,
  images,
}: {
  scope: EditScope;
  projectId: string;
  images: Asset[];
}) {
  const [uploadState, upload, uploading] = useActionState<EditorState, FormData>(
    uploadProjectImageRow,
    {},
  );
  const [removeState, remove, removing] = useActionState<EditorState, FormData>(
    removeProjectImageRow,
    {},
  );

  return (
    <div className="admin-images">
      <span className="field-label">Images</span>

      {images.length > 0 ? (
        <ul className="admin-thumbs">
          {images.map((image) => (
            <li className="admin-thumb" key={image.id}>
              {/* eslint-disable-next-line @next/next/no-img-element -- storage URLs are not on a configured next/image host; same as timeline and plates. */}
              <img src={image.src} alt={image.alt || 'Uploaded image'} />
              <form action={remove}>
                <ScopeFields scope={scope} />
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="imageId" value={image.id} />
                <input type="hidden" name="src" value={image.src} />
                <button
                  type="submit"
                  className="admin-thumb-remove"
                  disabled={removing}
                  aria-label="Remove image"
                >
                  ×
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : null}

      <form action={upload} className="admin-upload">
        <ScopeFields scope={scope} />
        <input type="hidden" name="projectId" value={projectId} />
        {/* The server sniffs the real bytes and enforces the allowlist; this is
            only the picker's hint. */}
        <input type="file" name="image" accept="image/*" required />
        <button type="submit" className="admin-button" disabled={uploading}>
          {uploading ? 'Uploading…' : 'Upload image'}
        </button>
      </form>

      <p className="admin-note">
        JPEG, PNG, WebP, AVIF or GIF, up to 10 MB. Location and camera metadata are stripped before
        it is stored.
      </p>

      <Feedback {...uploadState} />
      <Feedback {...removeState} />
    </div>
  );
}
