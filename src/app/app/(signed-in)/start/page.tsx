import { builderHref } from '@/lib/tenant-config';
import { currentUser } from '@/server/auth/session';
import { parseIssue } from '@/server/domain/parse-issue';
import { readSourceMaterial } from '@/server/repos/sourceMaterial';
import { starterIssue } from '@/content/starter';
import { documentsEnabled } from '@/server/services/draftProfile';

import { ImportGitHub } from '../sites/[siteId]/ImportGitHub';
import { Section } from '../sites/[siteId]/Section';
import { SettingsForm } from '../sites/[siteId]/SettingsForm';
import { PROFILE_SCOPE } from '../sites/[siteId]/scope';
import { Intake } from './Intake';

export const dynamic = 'force-dynamic';

/**
 * The first screen of a new account: tell us who you are, before you choose a
 * design.
 *
 * This reverses the ordering §23.2 settled on. That section weighed
 * gallery-then-import against import-then-gallery and called the second
 * "strictly better — you see your work in each design", choosing the first only
 * because a gallery is a nicer first impression than a file input. Sean's call
 * is the strictly-better one, and the reason is visible one screen later: with
 * nothing imported, every card in the gallery previews *demo* content, so the
 * picker shows a stranger's portfolio in two designs rather than yours in
 * either.
 *
 * Everything here is skippable, and skipping is a real option rather than a
 * dark pattern — an empty profile still reaches the gallery, still creates a
 * portfolio, and can be filled in at any point afterwards.
 *
 * All of it writes to `source_material`: template-agnostic, owned by the person
 * rather than by a portfolio, and the thing every future portfolio seeds from.
 */
export default async function Start() {
  const owner = await currentUser();
  const material = owner ? await readSourceMaterial(owner.id) : null;
  // Empty but valid, so the basics form has something to render before anything
  // has been imported. Nothing is stored until the person saves.
  const issue = material
    ? parseIssue(material.issue, material.issueSchemaVersion)
    : starterIssue('', owner?.email ?? '');

  const has =
    issue.experiences.length > 0 ||
    issue.projects.length > 0 ||
    issue.settings.displayName.trim() !== '';

  return (
    <>
      <div />

      <main className="admin-main">
        <div className="admin-head">
          <h1>Tell us about your work</h1>
          <p>
            Whatever you add here becomes your content — kept with you, not with any one portfolio,
            and used to show you each design with your own work in it.
          </p>
        </div>

        <Section title="From a document" id="document">
          <Intake enabled={documentsEnabled()} />
        </Section>

        <Section title="From GitHub" id="github">
          <ImportGitHub scope={PROFILE_SCOPE} />
        </Section>

        <Section title="Or just the basics" id="about">
          <SettingsForm scope={PROFILE_SCOPE} settings={issue.settings} />
        </Section>

        <div className="admin-stepnav">
          <span />
          <a className="admin-button admin-primary" href={builderHref('/new')}>
            {has ? 'Choose a design →' : 'Skip for now →'}
          </a>
        </div>

        {has ? null : (
          <p className="admin-note">
            You can skip this. The designs will preview sample content until you add your own, and
            everything here is on your content page whenever you want it.
          </p>
        )}
      </main>
    </>
  );
}
