'use client';

import { useActionState } from 'react';

import { importRepos, lookUpRepos, type ImportState } from './actions';
import { Feedback } from './Feedback';
import { ScopeFields, type EditScope } from './scope';

/**
 * Two steps, because picking is the point.
 *
 * Importing every public repo would be worse than useless — most accounts
 * carry coursework, dotfiles and things abandoned in a weekend, and a
 * portfolio that lists them says less than one that lists three. So the first
 * form finds the account and the second is a list of checkboxes, all unticked.
 */
export function ImportGitHub({ scope }: { scope: EditScope }) {
  const [found, lookUp, looking] = useActionState<ImportState, FormData>(lookUpRepos, {});
  const [imported, importAction, importing] = useActionState<ImportState, FormData>(
    importRepos,
    {},
  );

  const repos = found.repos ?? [];

  return (
    <>
      <form action={lookUp} className="admin-form">
        <label className="field">
          <span className="field-label">GitHub username</span>
          <input name="login" defaultValue={found.login ?? ''} autoComplete="off" spellCheck={false} placeholder="octocat" required />
          <span className="admin-note">
            Public repositories only. No GitHub sign-in needed, and nothing is added until you
            choose.
          </span>
        </label>

        <div className="admin-buttons">
          <button type="submit" className="admin-button admin-quiet" disabled={looking}>
            {looking ? 'Looking…' : 'Find repositories'}
          </button>
        </div>
      </form>

      <Feedback {...found} />

      {repos.length > 0 ? (
        <form action={importAction}>
          <ScopeFields scope={scope} />
          {/* The account, not the repositories. The server looks them up again
              (the fetch is cached for an hour, so this is free) rather than
              trusting a description and a URL that came back through the
              browser — plan §7: the browser sends intent, never data. */}
          <input type="hidden" name="login" value={found.login ?? ''} />

          <ul className="admin-list admin-list-linear">
            {repos.map((repo) => (
              <li key={repo.fullName}>
                <label className="admin-row">
                  <input type="checkbox" name="repo" value={repo.fullName} />
                  <span className="admin-row-main">
                    <strong>{repo.name}</strong>
                    <span className="admin-note">
                      {repo.description ?? 'No description on GitHub — you will need to write one.'}
                    </span>
                  </span>
                  {repo.language ? <span className="admin-flag admin-flag-live">{repo.language}</span> : null}
                </label>
              </li>
            ))}
          </ul>

          <div className="admin-buttons">
            <button type="submit" className="admin-button" disabled={importing}>
              {importing ? 'Importing…' : 'Import selected'}
            </button>
          </div>

          {/* Said before importing, not after: what arrives is a starting
              point, and the field that matters most is the one no API can
              answer. */}
          <p className="admin-note">
            Imported projects arrive as drafts. Each one needs a line on what it was for before you
            can publish — that is the part GitHub cannot tell us.
          </p>
        </form>
      ) : null}

      <Feedback {...imported} />
    </>
  );
}
