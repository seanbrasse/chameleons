import { notFound } from 'next/navigation';

import { loadEditor } from '@/server/services/editSite';
import { defaultsOf, describeOptions } from '@/server/domain/template-options';
// Manifests rather than the registry: this page names templates, it does not
// render one, so there is no reason to pull every design's stylesheet into it.
import { getManifest, listManifests } from '@/templates/manifests';

import { Customize } from '../Customize';
import { Steps, StepNav } from '../Steps';
import { TemplatePicker } from '../TemplatePicker';

export const dynamic = 'force-dynamic';

/**
 * Step one, and its own page.
 *
 * Choosing a design is a decision made by looking, so it gets a screen to look
 * on rather than a section competing with six content forms below it.
 */
export default async function DesignStep({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;

  const editor = await loadEditor(siteId);
  if (!editor) notFound();

  const chosen = getManifest(editor.templateId);

  // Defaults under the site's overrides, so a control shows what a visitor
  // would actually see rather than an empty box next to a true default.
  const optionFields = chosen ? describeOptions(chosen.options) : [];
  const optionValues = chosen ? { ...defaultsOf(chosen.options), ...editor.customization } : {};

  return (
    <>
      <Steps siteId={siteId} current="design" />

      <main className="admin-main">
        <div className="admin-head">
          <h1>Choose a design</h1>
          <p>Each one is showing your own content. Switching keeps every word of it.</p>
        </div>

        <section className="admin-section" id="template">
          <TemplatePicker
            siteId={editor.siteId}
            selectedId={editor.templateId}
            templates={listManifests().map((manifest) => ({
              id: manifest.id,
              name: manifest.name,
              description: manifest.description,
              constraint: manifest.constraint,
              attributes: manifest.attributes,
            }))}
          />
        </section>

        {chosen && optionFields.length > 0 ? (
          <section className="admin-section" id="options">
            <div className="admin-section-head">
              <h3>Options</h3>
              <span className="admin-note">{chosen.name}</span>
            </div>
            <Customize
              siteId={editor.siteId}
              templateId={editor.templateId}
              fields={optionFields}
              values={optionValues}
            />
          </section>
        ) : null}

        <StepNav siteId={siteId} current="design" />
      </main>
    </>
  );
}
