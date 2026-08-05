import 'server-only';

import Anthropic from '@anthropic-ai/sdk';

import type { Issue } from '@/content/types';
import { starterIssue } from '@/content/starter';
import { currentUser } from '@/server/auth/session';
import { SYSTEM, TOOL_NAME, TOOL_SCHEMA, applyDraft, gapsIn, readDraft } from '@/server/domain/draft';
import { parseIssue } from '@/server/domain/parse-issue';
import type { Target } from '@/server/services/editSite';
import { readSourceMaterial, writeSourceMaterial } from '@/server/repos/sourceMaterial';
import { readWorkingState, writeDraftIssue } from '@/server/repos/sites';

/** Longer than a résumé, since this also takes a pasted write-up. */
const TEXT_CAP = 24_000;

/** Comfortably under Vercel's ~4.5MB request body limit, which a Server Action shares. */
const FILE_CAP = 4 * 1024 * 1024;

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5';

export type DraftInput = {
  text?: string;
  file?: { name: string; type: string; bytes: ArrayBuffer };
};

export type DraftResult =
  | { ok: true; gaps: string[]; counts: { roles: number; schools: number; projects: number } }
  | { ok: false; reason: string };

/** Whether the builder should offer the document box at all. */
export function documentsEnabled(): boolean {
  return (process.env.ANTHROPIC_API_KEY ?? '') !== '';
}

/**
 * Read the current content for a target, or a fresh starter if there is none.
 * A profile with nothing stored yet is the ordinary first visit, not an error.
 */
async function readCurrent(target: Target, ownerId: string, email: string): Promise<Issue | null> {
  if (target.kind === 'profile') {
    const stored = await readSourceMaterial(ownerId);
    return stored ? parseIssue(stored.issue, stored.issueSchemaVersion) : starterIssue('', email);
  }

  const working = await readWorkingState(target.siteId, ownerId);
  return working ? parseIssue(working.issue, working.issueSchemaVersion) : null;
}

/** Write merged content back where it came from. Both writes are owner-scoped. */
async function writeBack(target: Target, ownerId: string, issue: Issue): Promise<boolean> {
  return target.kind === 'profile'
    ? writeSourceMaterial(ownerId, issue)
    : writeDraftIssue(target.siteId, ownerId, issue);
}

/**
 * Read a document or pasted text into content, additively.
 *
 * The same call serves the profile (§23.4 — who someone is, seeded into every
 * portfolio) and one site's draft (this portfolio only): both hold an `Issue`,
 * and `draftInto` differs only in which one it reads and writes, exactly as
 * `saveIssue` does. That is why autofill can sit on the content step and the
 * intake screen without two pipelines.
 *
 * It **merges** rather than overwrites (`applyDraft`), so running it on an
 * editor a person has already started updates matching rows in place and leaves
 * everything else — including hand-typed rows and every project's images and
 * impact — untouched. Convenience that eats your work is not convenience.
 *
 * **Parse and discard** (§23.6): the bytes are read here and never stored, so
 * none of the upload pipeline applies. Nothing here is served to a stranger.
 */
export async function draftInto(target: Target, input: DraftInput): Promise<DraftResult> {
  const owner = await currentUser();
  if (!owner) return { ok: false, reason: 'Your session has expired. Sign in again.' };

  if (!documentsEnabled()) {
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

  // Read the target first, so a site that is not the caller's fails before the
  // model is ever called rather than after paying for it.
  const current = await readCurrent(target, owner.id, owner.email);
  if (!current) return { ok: false, reason: 'That portfolio is not yours to edit.' };

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
  const next = applyDraft(current, draft);

  if (!(await writeBack(target, owner.id, next))) {
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
