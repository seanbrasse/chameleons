import type { ReactNode } from 'react';
import type { z } from 'zod';

import type { Issue } from '@/content/types';

/** How much a design leans on imagery — a real axis the templates differ on. */
export type TemplateImagery = 'image-forward' | 'balanced' | 'text-led';

/**
 * The facets a person browses templates by, kept structured rather than buried
 * in prose so the picker can filter and sort on them (plan §23.2). `description`
 * and `constraint` are still what a card reads out; these are what it filters by.
 */
export type TemplateAttributes = {
  /** Who the design is built for — the primary filter. At least one. */
  useCases: string[];
  /** Whether the work is looked at or read. */
  imagery: TemplateImagery;
};

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
  /** The facets the picker filters and sorts by. */
  attributes: TemplateAttributes;
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
