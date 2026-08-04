#!/usr/bin/env node
/**
 * Plan §22.4, and deliberately the only automated changelog rule there is:
 *
 *   If a template's manifest changes its `version`, that template's
 *   CHANGELOG.md must change in the same commit range.
 *
 * Narrow on purpose. It fires only on a version bump, so it never nags
 * ordinary work — and a version bump without an entry is precisely the failure
 * that strands users on an old template with no way to evaluate the new one
 * (§22.2). There is no equivalent rule for the product changelog; a bot
 * demanding an entry on every PR is how changelogs fill with "fix typo".
 */

import { execFileSync } from 'node:child_process';

const range = process.argv[2];

if (!range) {
  console.error('usage: check-template-changelogs.mjs <base>...<head>');
  process.exit(2);
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });

const changed = git('diff', '--name-only', range).split('\n').filter(Boolean);

const manifests = changed.filter((file) =>
  /^src\/templates\/[^/]+\/manifest\.ts$/.test(file),
);

const failures = [];

for (const manifest of manifests) {
  const id = manifest.split('/')[2];

  // Only a change to the `version` line counts. Editing a description or
  // adding an option is not a version bump and must not demand an entry.
  const patch = git('diff', '-U0', range, '--', manifest);
  const touchedVersion = patch
    .split('\n')
    .filter((line) => /^[+-][^+-]/.test(line))
    .some((line) => /\bversion\s*:/.test(line));

  if (!touchedVersion) continue;

  const changelog = `src/templates/${id}/CHANGELOG.md`;
  if (!changed.includes(changelog)) failures.push({ id, changelog });
}

if (failures.length > 0) {
  for (const { id, changelog } of failures) {
    console.error(
      `${id}: manifest version changed but ${changelog} did not.\n` +
        `  A pinned site cannot tell what moved between its version and the new one.\n` +
        `  Add an entry saying what changed visually, whether it breaks existing\n` +
        `  customization, and whether upgrading is safe without re-checking the design.`,
    );
  }
  process.exit(1);
}

console.log(
  manifests.length === 0
    ? 'No template manifests changed.'
    : `Checked ${manifests.length} changed manifest(s); no unlogged version bumps.`,
);
