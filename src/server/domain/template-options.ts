import type { z } from 'zod';

/**
 * Reading a template's option schema well enough to render a form from it.
 *
 * `manifest.options` is a Zod schema and the plan (§6) says the builder renders
 * its form from that, so a template gains a control by declaring an option
 * rather than by anyone editing the builder. This is the reading half.
 *
 * Pure, and deliberately narrow: booleans and enums are what templates
 * actually declare today. Anything else is reported as `unsupported` rather
 * than guessed at, so a new option kind shows up as a visible gap instead of a
 * silently missing control.
 */

export type OptionField =
  | { name: string; label: string; description: string; kind: 'boolean'; fallback: boolean }
  | {
      name: string;
      label: string;
      description: string;
      kind: 'enum';
      values: string[];
      fallback: string;
    }
  | { name: string; label: string; description: string; kind: 'unsupported' };

/** `defaultTheme` -> `Default theme`. */
export function humanizeKey(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

type Def = { type?: string; innerType?: { def?: Def }; entries?: Record<string, string> };
type Node = { def?: Def; description?: string };

export function describeOptions(schema: z.ZodType<unknown>): OptionField[] {
  const shape = (schema as unknown as { shape?: Record<string, Node> }).shape;
  if (!shape) return [];

  return Object.entries(shape).map(([name, node]) => {
    const label = humanizeKey(name);
    // A `.describe()` on the option, which is where the human sentence lives —
    // a JSDoc comment cannot reach the browser.
    const description = node.description ?? '';

    // Every option carries `.default(...)`, so the interesting node is one
    // level in. Reading through it rather than around it keeps the fallback
    // and the kind in agreement.
    const outer = node.def;
    const inner = outer?.innerType?.def ?? outer;
    const fallback = defaultOf(node);

    if (inner?.type === 'boolean') {
      return { name, label, description, kind: 'boolean', fallback: fallback === true };
    }

    if (inner?.type === 'enum' && inner.entries) {
      const values = Object.values(inner.entries);
      return {
        name,
        label,
        description,
        kind: 'enum',
        values,
        fallback: typeof fallback === 'string' ? fallback : (values[0] ?? ''),
      };
    }

    return { name, label, description, kind: 'unsupported' };
  });
}

/** The schema's own defaults, which is what "unset" means on the wire. */
export function defaultsOf(schema: z.ZodType<unknown>): Record<string, unknown> {
  const parsed = schema.safeParse({});
  return parsed.success ? (parsed.data as Record<string, unknown>) : {};
}

function defaultOf(node: Node): unknown {
  const value = (node as unknown as { def?: { defaultValue?: unknown } }).def?.defaultValue;
  return typeof value === 'function' ? (value as () => unknown)() : value;
}

/**
 * Stores only what differs from the schema's defaults.
 *
 * Plan §6: improving a default should improve every site that never overrode
 * it. Writing the fully-resolved object instead would freeze today's defaults
 * into every row and quietly opt everyone out of the next improvement.
 */
export function diffFromDefaults(
  schema: z.ZodType<unknown>,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const defaults = defaultsOf(schema);
  const diff: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(values)) {
    if (!Object.is(defaults[key], value)) diff[key] = value;
  }

  return diff;
}
