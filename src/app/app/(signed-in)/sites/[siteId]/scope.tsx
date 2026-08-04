import type { Target } from '@/server/services/editSite';

/**
 * Which thing a row is editing: one portfolio's draft, or the person's own
 * source material.
 *
 * The same rows serve both, because both hold an `Issue` and every transform in
 * `domain/edit-*.ts` already works on either. A second set of row components
 * for the profile would be six more files that have to stay in step with these.
 *
 * An object rather than a bare `siteId`, so "no site" is a case the type
 * carries rather than a magic empty string a reader has to recognise.
 */
export type EditScope = Target;

export const siteScope = (siteId: string): EditScope => ({ kind: 'site', siteId });

export const PROFILE_SCOPE: EditScope = { kind: 'profile' };

/**
 * The hidden fields every scoped form posts.
 *
 * `siteId` is untrusted and always was — the service resolves the owner from
 * the session and scopes the write. The profile carries no id at all, so there
 * is nothing in that request to forge.
 */
export function ScopeFields({ scope }: { scope: EditScope }) {
  return scope.kind === 'profile' ? (
    <input type="hidden" name="scope" value="profile" />
  ) : (
    <input type="hidden" name="siteId" value={scope.siteId} />
  );
}
