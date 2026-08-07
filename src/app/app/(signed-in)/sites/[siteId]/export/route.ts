import { exportBundle, exportFilename } from '@/server/domain/export';
import { loadEditor } from '@/server/services/editSite';

export const dynamic = 'force-dynamic';

/**
 * Download this portfolio's content as JSON.
 *
 * A route handler rather than a server action, because the deliverable is a file
 * the browser saves: the `Content-Disposition` makes the click a download, with
 * no client component and no `Blob` dance. `loadEditor` is the same owner-scoped
 * read every builder page uses, so a site id that is not the caller's returns
 * 404 exactly as a page would — there is no policy underneath, the ownership
 * check *is* the gate.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> },
): Promise<Response> {
  const { siteId } = await params;

  const editor = await loadEditor(siteId);
  if (!editor) return new Response('Not found', { status: 404 });

  const bundle = exportBundle(editor.issue, new Date().toISOString());
  const filename = exportFilename(editor.issue.settings.displayName, editor.subdomain);

  return new Response(JSON.stringify(bundle, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      // The content is the person's own and changes as they edit; never let a
      // shared cache hold a stale copy of someone's portfolio.
      'cache-control': 'no-store',
    },
  });
}
