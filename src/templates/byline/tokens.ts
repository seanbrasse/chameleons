/**
 * This template's colour vocabulary — six names, dual-theme, its own values.
 *
 * The same six *names* as `curriculum`/`dossier` (paper/ink/…): all three are
 * text-led documents, and the roles a document's palette needs are the same.
 * The values are not — plum here, oxford blue and printer red there — which is
 * what keeps the three from reading as one site (plan §6: a design owns its
 * tokens, and convergence is grounds for extraction only after it happens).
 * Every value lives here; a lint rule fails on a colour literal anywhere else
 * under `src/`.
 *
 * The values are the comp's, after its floor pass: both themes clear WCAG AA,
 * with the faint margin tone held above 5:1 — the shade a proper-looking margin
 * grey fails.
 */

export type BylinePalette = {
  /** The page. */
  paper: string;
  /** The prose. Every sentence that carries meaning is ink, never accent. */
  ink: string;
  /** Secondary prose — the work paragraph, the "by" in the byline. */
  inkQuiet: string;
  /** The margin: dates, the intro meta line. Quieter, still legible. */
  inkFaint: string;
  /** Hairlines between pieces and above the role list. */
  rule: string;
  /** Plum. Links, the section kicker, the kicker rule — nothing else. */
  accent: string;
};

export type BylineTokens = {
  palettes: { light: BylinePalette; dark: BylinePalette };
};

const light: BylinePalette = {
  paper: '#fbf9f6',
  ink: '#211c1f',
  inkQuiet: '#5c545a',
  inkFaint: '#6d646b',
  rule: '#e6e0da',
  accent: '#8a3d63',
};

const dark: BylinePalette = {
  paper: '#17141a',
  ink: '#efe9ec',
  inkQuiet: '#b0a6ad',
  inkFaint: '#948a92',
  rule: '#322b33',
  accent: '#d98cb0',
};

export const defaultTokens: BylineTokens = { palettes: { light, dark } };

const CUSTOM_PROPERTY: Record<keyof BylinePalette, string> = {
  paper: '--paper',
  ink: '--ink',
  inkQuiet: '--ink-quiet',
  inkFaint: '--ink-faint',
  rule: '--rule',
  accent: '--accent',
};

function declarations(palette: BylinePalette): string {
  return (Object.keys(CUSTOM_PROPERTY) as (keyof BylinePalette)[])
    .map((key) => `${CUSTOM_PROPERTY[key]}:${palette[key]}`)
    .join(';');
}

/** Injected per request from the snapshot; `data-theme="dark"` overrides light. */
export function stylesheet(tokens: BylineTokens): string {
  return [
    `:root{${declarations(tokens.palettes.light)}}`,
    `[data-theme="dark"]{${declarations(tokens.palettes.dark)}}`,
  ].join('');
}
