import { builderHref } from '@/lib/tenant-config';
import { currentUser } from '@/server/auth/session';
import { parseIssue } from '@/server/domain/parse-issue';
import { readSourceMaterial } from '@/server/repos/sourceMaterial';
import { starterIssue } from '@/content/starter';

import { EducationRow } from '../sites/[siteId]/EducationRow';
import { ExperienceRow } from '../sites/[siteId]/ExperienceRow';
import { ImportGitHub } from '../sites/[siteId]/ImportGitHub';
import { MetricRow } from '../sites/[siteId]/MetricRow';
import { Phase } from '../sites/[siteId]/Phase';
import { ProjectRow } from '../sites/[siteId]/ProjectRow';
import { Rail, type RailGroup } from '../sites/[siteId]/Rail';
import { Section } from '../sites/[siteId]/Section';
import { SettingsForm } from '../sites/[siteId]/SettingsForm';
import { TestimonialRow } from '../sites/[siteId]/TestimonialRow';
import { PROFILE_SCOPE } from '../sites/[siteId]/scope';

export const dynamic = 'force-dynamic';

/**
 * Your content, not any one portfolio's.
 *
 * `source_material` has existed since §23.4 but only an import could write it,
 * which made a person's own content something that happened to them rather than
 * something they kept. This is the screen that makes it theirs.
 *
 * Every section is asked for here, unconditionally. A design decides what *it*
 * shows (§23.7, and the editor does exactly that), but this page belongs to no
 * design — filtering it by a template would be the tail wagging the dog, and
 * the whole point of material owned by the person is that it outlives the
 * portfolio that happened to be open when it was typed.
 *
 * The rows are the editor's own, scoped to the profile rather than to a site.
 * They work unchanged because both hold an `Issue` and every transform in
 * `domain/edit-*.ts` is already written against one.
 */
export default async function Profile() {
  const owner = await currentUser();

  const material = owner ? await readSourceMaterial(owner.id) : null;

  // Nothing stored yet is the ordinary first visit, not an error: source
  // material is something a person accumulates, and the first save creates it.
  const issue = material
    ? parseIssue(material.issue, material.issueSchemaVersion)
    : starterIssue('', owner?.email ?? '');

  const scope = PROFILE_SCOPE;

  const rail: RailGroup[] = [
    {
      label: 'Your content',
      links: [
        { id: 'about', label: 'About' },
        { id: 'experience', label: 'Experience', count: issue.experiences.length },
        { id: 'projects', label: 'Projects', count: issue.projects.length },
        { id: 'education', label: 'Education', count: issue.education.length },
        { id: 'testimonials', label: 'Testimonials', count: issue.testimonials.length },
        { id: 'metrics', label: 'Metrics', count: issue.metrics.length },
      ],
    },
  ];

  return (
    <>
      <Rail groups={rail} />

      <main className="admin-main">
        <div className="admin-head">
          <h1>Your content</h1>
          <p>
            Written once and kept with you. Every new portfolio starts from this, and each one is
            edited on its own afterwards — so changing a portfolio never changes this, and changing
            this never changes a portfolio you have already made.
          </p>
        </div>

        <Phase n="—" title="Everything about you" note="Saved as you go">
          <Section title="About" id="about">
            <SettingsForm scope={scope} settings={issue.settings} />
          </Section>

          <Section title="Experience" id="experience">
            <div className="admin-rows">
              {issue.experiences.map((item) => (
                <ExperienceRow key={item.id} scope={scope} experience={item} />
              ))}
              <ExperienceRow scope={scope} experience={null} />
            </div>
          </Section>

          <Section title="Projects" id="projects">
            <h4 className="admin-subhead">Import from GitHub</h4>
            <ImportGitHub scope={scope} />

            <div className="admin-rows">
              {issue.projects.map((item) => (
                <ProjectRow
                  key={item.id}
                  scope={scope}
                  project={item}
                  employers={issue.experiences}
                />
              ))}
              <ProjectRow scope={scope} project={null} employers={issue.experiences} />
            </div>
          </Section>

          <Section title="Education" id="education">
            <div className="admin-rows">
              {issue.education.map((item) => (
                <EducationRow key={item.id} scope={scope} entry={item} />
              ))}
              <EducationRow scope={scope} entry={null} />
            </div>
          </Section>

          <Section title="Testimonials" id="testimonials">
            <div className="admin-rows">
              {issue.testimonials.map((item) => (
                <TestimonialRow
                  key={item.id}
                  scope={scope}
                  testimonial={item}
                  employers={issue.experiences}
                />
              ))}
              <TestimonialRow scope={scope} testimonial={null} employers={issue.experiences} />
            </div>
          </Section>

          <Section title="Metrics" id="metrics">
            <div className="admin-rows">
              {issue.metrics.map((item) => (
                <MetricRow key={item.id} scope={scope} metric={item} />
              ))}
              <MetricRow scope={scope} metric={null} />
            </div>
          </Section>
        </Phase>

        <p className="admin-note">
          <a href={builderHref('/')}>Back to your portfolios</a>
        </p>
      </main>
    </>
  );
}
