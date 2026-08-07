import { ISSUE_SCHEMA_VERSION, type Issue } from '@/content/types';

/**
 * A portfolio's content, packaged to take away.
 *
 * The landing page promises "your content belongs to you and comes with you";
 * this is that made literal — the whole `Issue`, the same shape the builder
 * edits and the renderer reads, handed back as a file the owner keeps. It is
 * deliberately the raw content and not a rendered page: the design is the
 * template's, and switching designs is free, but the words, the projects, the
 * dates are the person's, and those are what an export has to preserve.
 *
 * Pure: the timestamp is passed in rather than read here, so the bundle is a
 * deterministic function of its inputs and can be unit-tested without a clock.
 */
export type ExportBundle = {
  /** A stable marker so a future importer can recognise its own files. */
  format: 'chameleons.portfolio';
  schemaVersion: number;
  exportedAt: string;
  content: Issue;
};

export function exportBundle(issue: Issue, exportedAt: string): ExportBundle {
  return {
    format: 'chameleons.portfolio',
    schemaVersion: ISSUE_SCHEMA_VERSION,
    exportedAt,
    content: issue,
  };
}

/**
 * A filename a person can find later: their address if they have claimed one,
 * else their name, slugged, always ending `-chameleons.json`. Falls back to a
 * plain `portfolio` so an unnamed, unclaimed draft still exports to something
 * openable rather than to `-chameleons.json` with nothing in front.
 */
export function exportFilename(displayName: string, subdomain: string | null): string {
  const base = (subdomain || displayName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${base || 'portfolio'}-chameleons.json`;
}
