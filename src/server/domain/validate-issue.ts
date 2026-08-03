import type { Issue } from './issue';

export type IssueProblem = {
  path: string;
  message: string;
};

const MAX_TAGLINE = 200;
const MAX_SUMMARY = 500;

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * The publish gate. Returns problems rather than throwing because the builder
 * shows all of them at once; a thrown error would surface only the first.
 */
export function validateIssue(issue: Issue): IssueProblem[] {
  const problems: IssueProblem[] = [];

  const { displayName, tagline } = issue.settings;

  // The display name is the rendered <h1>. An empty one publishes a nameless page.
  if (displayName.trim() === '') {
    problems.push({ path: 'settings.displayName', message: 'A display name is required.' });
  }

  if (tagline.length > MAX_TAGLINE) {
    problems.push({
      path: 'settings.tagline',
      message: `A tagline may be at most ${MAX_TAGLINE} characters.`,
    });
  }

  const seenIds = new Set<string>();

  issue.projects.forEach((project, index) => {
    const at = `projects[${index}]`;

    if (project.id.trim() === '') {
      problems.push({ path: `${at}.id`, message: 'A project needs an id.' });
    } else if (seenIds.has(project.id)) {
      problems.push({ path: `${at}.id`, message: `Duplicate project id "${project.id}".` });
    } else {
      seenIds.add(project.id);
    }

    if (project.title.trim() === '') {
      problems.push({ path: `${at}.title`, message: 'A project needs a title.' });
    }

    if (project.summary.length > MAX_SUMMARY) {
      problems.push({
        path: `${at}.summary`,
        message: `A summary may be at most ${MAX_SUMMARY} characters.`,
      });
    }

    project.links.forEach((link, linkIndex) => {
      if (!isHttpUrl(link.url)) {
        problems.push({
          path: `${at}.links[${linkIndex}].url`,
          message: 'A link must be an http or https URL.',
        });
      }
    });
  });

  return problems;
}
