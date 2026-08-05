import 'server-only';

import Anthropic from '@anthropic-ai/sdk';

import { starterIssue } from '@/content/starter';
import { currentUser } from '@/server/auth/session';
import { SYSTEM, TOOL_NAME, TOOL_SCHEMA, applyDraft, gapsIn, readDraft } from '@/server/domain/draft';
import { parseIssue } from '@/server/domain/parse-issue';
import { readSourceMaterial, writeSourceMaterial } from '@/server/repos/sourceMaterial';

/** Longer than a résumé, since this also takes a pasted write-up. */
const TEXT_CAP = 24_000;

/** Comfortably under Vercel's ~4.5MB request body limit, which a Server Action shares. */
const FILE_CAP = 4 * 1024 * 1024;

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5';

export type DraftResult =
  | { ok: true; gaps: string[]; counts: { roles: number; schools: number; projects: number } }
  | { ok: false; reason: string };

function configured(): boolean {
  return (process.env.ANTHROPIC_API_KEY ?? '') !== '';
}

/**
 * Read a document or some pasted text into the person's own content.
 *
 * Writes to `source_material`, not to a site: this is who someone is rather
 * than what one portfolio says, so every portfolio they ever make seeds from it
 * (§23.4). Content flows profile → portfolio, one way.
 *
 * **Parse and discard** (§23.6). The bytes are read, the facts are kept, and
 * the file is never stored — so this needs none of the upload pipeline: no
 * EXIF, no quota, no MIME allowlist, because nothing here is ever served to a
 * stranger. Hosting a résumé for download is a different feature.
 */
export async function draftProfileFrom(input: {
  text?: string;
  file?: { name: string; type: string; bytes: ArrayBuffer };
}): Promise<DraftResult> {
  const owner = await currentUser();
  if (!owner) return { ok: false, reason: 'Your session has expired. Sign in again.' };

  if (!configured()) {
    return {
      ok: false,
      reason:
        'Reading documents is not switched on yet — this deployment has no ANTHROPIC_API_KEY. You can still import from GitHub or type your details in.',
    };
  }

  const pasted = (input.text ?? '').trim().slice(0, TEXT_CAP);
  const file = input.file;

  if (!pasted && !file) return { ok: false, reason: 'Add a document or paste some text first.' };
  if (file && file.bytes.byteLength > FILE_CAP) {
    return { ok: false, reason: 'That file is over 4MB. Try a smaller export, or paste the text.' };
  }

  const content: Anthropic.MessageParam['content'] = [];

  if (file) {
    // The Messages API takes a PDF directly, which is why this needs no
    // text-extraction library — the one part of résumé import that looked like
    // a dependency and is not.
    if (file.type === 'application/pdf') {
      content.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: Buffer.from(file.bytes).toString('base64'),
        },
      });
    } else {
      const asText = Buffer.from(file.bytes).toString('utf8').slice(0, TEXT_CAP);
      if (!asText.trim()) {
        return { ok: false, reason: 'That file could not be read. A PDF or plain text works best.' };
      }
      content.push({ type: 'text', text: `Document "${file.name}":\n\n${asText}` });
    }
  }

  if (pasted) content.push({ type: 'text', text: `Pasted by the person:\n\n${pasted}` });

  content.push({
    type: 'text',
    text: 'Record what this says about them. Leave anything it does not state empty.',
  });

  let reply;
  try {
    reply = await new Anthropic().messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM,
      // Forced, so the answer arrives as validated structure rather than prose
      // we hope parses as JSON.
      tools: [{ name: TOOL_NAME, description: 'Record the profile.', input_schema: TOOL_SCHEMA }],
      tool_choice: { type: 'tool', name: TOOL_NAME },
      messages: [{ role: 'user', content }],
    });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401) return { ok: false, reason: 'The Anthropic API key was rejected.' };
    if (status === 429) return { ok: false, reason: 'Rate limited — try again in a moment.' };
    return { ok: false, reason: 'That document could not be read. Try again, or type it in.' };
  }

  const call = reply.content.find((block) => block.type === 'tool_use');
  if (!call || call.type !== 'tool_use') {
    return { ok: false, reason: 'Nothing usable came back. Try again, or type it in.' };
  }

  const draft = readDraft(call.input);

  const stored = await readSourceMaterial(owner.id);
  const current = stored
    ? parseIssue(stored.issue, stored.issueSchemaVersion)
    : starterIssue('', owner.email);

  const next = applyDraft(current, draft);
  if (!(await writeSourceMaterial(owner.id, next))) {
    return { ok: false, reason: 'Could not save what was read. Try again.' };
  }

  return {
    ok: true,
    gaps: gapsIn(draft),
    counts: {
      roles: draft.experiences.length,
      schools: draft.education.length,
      projects: draft.projects.length,
    },
  };
}

/** Whether the builder should offer the document box at all. */
export function documentsEnabled(): boolean {
  return configured();
}
