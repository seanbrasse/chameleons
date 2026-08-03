/**
 * The content contract every template renders and every snapshot stores.
 *
 * Bumping this constant is the trigger for a new case in `parse-issue.ts`:
 * snapshots already in the database keep their old `issue_schema_version`
 * forever, so the reader — not a backfill — is what makes them keep working.
 */
export const ISSUE_SCHEMA_VERSION = 1;

export type IssueLink = {
  label: string;
  url: string;
};

export type IssueProject = {
  id: string;
  title: string;
  summary: string;
  images: string[];
  poster: string | null;
  links: IssueLink[];
};

export type IssueSettings = {
  displayName: string;
  tagline: string;
  logo: string | null;
};

export type Issue = {
  settings: IssueSettings;
  projects: IssueProject[];
};
