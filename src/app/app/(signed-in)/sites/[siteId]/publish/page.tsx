import { notFound } from 'next/navigation';

import { builderHref, tenantConfig } from '@/lib/tenant-config';
import { loadEditor } from '@/server/services/editSite';
import { loadHistory } from '@/server/services/rollbackSite';

import { DeleteSite } from '../DeleteSite';
import { History } from '../History';
import { PublishBar } from '../PublishBar';
import { Steps, StepNav } from '../Steps';

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
