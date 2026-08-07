import { notFound } from 'next/navigation';

import { builderHref, tenantConfig } from '@/lib/tenant-config';
import { portfolioAdvice } from '@/server/domain/portfolio-advisor';
import { loadEditor } from '@/server/services/editSite';
import { loadHistory } from '@/server/services/rollbackSite';
import { getManifest } from '@/templates/manifests';

import { DeleteSite } from '../DeleteSite';
import { History } from '../History';
import { PublishBar } from '../PublishBar';
import { Steps, StepNav } from '../Steps';
import { StrengthAdvisor } from '../StrengthAdvisor';

export const dynamic = 'force-dynamic';

/**
 * Step three, and last on purpose.
 *
 * Nothing is named until it ships (plan §14 Phase 2): the address is claimed
 * here rather than at creation, so a name is never burned on a portfolio that
 * is never written. Splitting the builder into steps is what finally makes that
 * ordering visible — publish used to sit on the same screen as the first empty
 * field.
 */
export default async function PublishStep({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;

  const editor = await loadEditor(siteId);
  if (!editor) notFound();

  const history = await loadHistory(siteId);
  const { mode, rootDomain } = tenantConfig();

  // A pre-flight, not a gate: publishing stays available whatever it says. The
  // manifest is null when the site names a design this build no longer ships,
  // and the advisor then reasons about every section rather than none.
  const advice = portfolioAdvice(editor.issue, getManifest(editor.templateId));

  return (
    <>
      <Steps siteId={siteId} current="publish" />

      <main className="admin-main">
        <div className="admin-head">
          <h1>Publish</h1>
          <p>
            {editor.publishedVersion === null
              ? 'Claim an address, then put it online. Nothing is public until you do.'
              : 'Your portfolio is live. Publishing again replaces what visitors see.'}
          </p>
        </div>

        <section className="admin-section" id="publish">
          <PublishBar
            siteId={editor.siteId}
            subdomain={editor.subdomain}
            suffix={mode === 'path' ? '' : `.${rootDomain}`}
            publishedVersion={editor.publishedVersion}
            previewHref={builderHref(`/preview/${editor.siteId}`)}
          />
        </section>

        <section className="admin-section" id="strength">
          <div className="admin-section-head">
            <h3>Strength</h3>
            {advice.length > 0 ? <span className="admin-note">{advice.length}</span> : null}
          </div>
          <p className="admin-note">
            Suggestions from what you have written. None of them block publishing — they are what
            would make the page land harder.
          </p>
          <StrengthAdvisor siteId={editor.siteId} advice={advice} />
        </section>

        <section className="admin-section" id="export">
          <div className="admin-section-head">
            <h3>Export</h3>
          </div>
          <p className="admin-note">
            Download everything you have written as a JSON file. Your content is yours and comes
            with you between designs; this is the copy you keep.
          </p>
          <div className="admin-buttons">
            {/* A route handler, not an action: the response is a file with a
                Content-Disposition, so the link itself is the download. */}
            <a className="admin-button" href={builderHref(`/sites/${editor.siteId}/export`)} download>
              Download content (JSON)
            </a>
          </div>
        </section>

        <section className="admin-section" id="history">
          <div className="admin-section-head">
            <h3>History</h3>
            <span className="admin-note">{history.length}</span>
          </div>
          <History
            siteId={editor.siteId}
            entries={history}
            liveVersion={editor.publishedVersion}
          />
        </section>

        <section className="admin-section" id="delete">
          <div className="admin-section-head">
            <h3>Delete</h3>
          </div>
          <DeleteSite
            siteId={editor.siteId}
            subdomain={editor.subdomain}
            publishedVersion={editor.publishedVersion}
          />
        </section>

        <StepNav siteId={siteId} current="publish" />
      </main>
    </>
  );
}
