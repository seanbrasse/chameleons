import type { ReactNode } from 'react';
import type { z } from 'zod';

import type { Issue } from '@/content/types';

/**
 * Templates share a floor, not a design system. `Issue` and the invariants in
 * `floor.ts` are common to all of them; tokens, sections, CSS and components are
 * each template's own. Both generics are the template's — there is deliberately
 * no universal palette type here.
 */
export type TemplateManifest<TOptions> = {
  id: string;
  name: string;
  version: number;
  description: string;
  /** Which parts of an Issue this template can show, so the builder can warn about gaps. */
  uses: Array<keyof Issue>;
  /** The customization schema. The builder renders its form from this. */
  options: z.ZodType<TOptions>;
  /** The one hard rule this design is built around. */
  constraint: string;
  /** The artifacts it was designed from. */
  references: string[];
};

export type TemplateProps<TTokens, TOptions> = {
  issue: Issue;
  tokens: TTokens;
  options: TOptions;
};

export type Template<TTokens, TOptions> = {
  manifest: TemplateManifest<TOptions>;
  defaultTokens: TTokens;
  /** Emits this template's own custom properties. There is no shared token vocabulary. */
  stylesheet: (tokens: TTokens) => string;
  Component: (props: TemplateProps<TTokens, TOptions>) => ReactNode;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the registry is heterogeneous by design: each entry has its own token and option types.
export type AnyTemplate = Template<any, any>;

/**
 * Parse stored customization forward-compatibly: unknown keys survive a round
 * trip, and a template that gained an option picks up its default rather than
 * throwing on rows written before it existed.
 */
export function parseOptions<TOptions>(
  manifest: TemplateManifest<TOptions>,
  stored: unknown,
): TOptions {
  const parsed = manifest.options.safeParse(stored ?? {});
  return parsed.success ? parsed.data : manifest.options.parse({});
}
