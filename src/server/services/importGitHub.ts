import 'server-only';

import { importable, readRepos, type RepoSummary } from '@/server/domain/github';

export type FetchResult =
  | { ok: true; repos: RepoSummary[] }
  | { ok: false; reason: 'not-found' | 'rate-limited' | 'unavailable' };

const API = 'https://api.github.com';

/**
 * A GitHub account's public repositories.
 *
 * Unauthenticated (plan §13.1), so this works the same for a Google-signed-in
 * user as for a GitHub-signed-in one. The ceiling is 60 requests an hour per
 * IP — which on a serverless platform is per outbound address and therefore
 * shared, so `rate-limited` is a state the UI has to be able to say out loud
 * rather than an impossibility.
 */
export async function fetchRepos(login: string): Promise<FetchResult> {
  const clean = login.trim().replace(/^@/, '');

  // GitHub logins are alphanumeric with single hyphens, 39 characters at most.
  // Checked before the request so a pasted URL or an email fails here rather
  // than spending one of the hour's sixty on a certain 404.
  if (!/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(clean)) {
    return { ok: false, reason: 'not-found' };
  }

  let response: Response;
  try {
    response = await fetch(`${API}/users/${clean}/repos?per_page=100&sort=pushed`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      // The list changes when the user pushes, not when we ask. An hour keeps
      // a second look at the same account off the rate limit entirely.
      next: { revalidate: 3600 },
    });
  } catch {
    return { ok: false, reason: 'unavailable' };
  }

  if (response.status === 404) return { ok: false, reason: 'not-found' };

  // 403 with the remaining count at zero is the rate limit; a 403 for any other
  // reason is not, and telling someone to wait an hour would be wrong.
  if (response.status === 403 || response.status === 429) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    return { ok: false, reason: remaining === '0' ? 'rate-limited' : 'unavailable' };
  }

  if (!response.ok) return { ok: false, reason: 'unavailable' };

  try {
    return { ok: true, repos: importable(readRepos(await response.json())) };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
