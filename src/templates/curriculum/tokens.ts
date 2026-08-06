/**
 * This template's colour vocabulary — six names, dual-theme, its own values.
 *
 * The same six *names* as `dossier` (paper/ink/…): both are document templates,
 * and the roles a document's palette needs are genuinely the same. The values
 * are not — oxford blue where `dossier` uses printer red — which is what keeps
 * the two from reading as one site (plan §6: a design owns its tokens, and two
 * templates converging is grounds for extraction only after it actually
 * happens). Every value lives here; a lint rule fails on a colour literal
 * anywhere else under `src/`.
 *
 * The values are the comp's, after its floor pass: both themes clear WCAG AA
 * with the margin/faint tone above 5:1, the shade that a proper-looking margin
 * grey fails.
 */

export type CurriculumPalette = {
  /** The page. */
  paper: string;
  /** Text. */
  ink: string;
  /** Secondary text — affiliation, roles, numeral captions. */
  inkQuiet: string;
  /** The margin: dates, section notes, the counter. Quieter, still legible. */
  inkFaint: string;
  /** Hairlines under section heads and between awards. */
  rule: string;
  /** Oxford blue. Section numbers, venues and links — nothing else. */
  accent: string;
};

export type CurriculumTokens = {
  palettes: { light: CurriculumPalette; dark: CurriculumPalette };
};

const light: CurriculumPalette = {
  paper: '#fbfaf7',
  ink: '#1a1a1c',
  inkQuiet: '#55555c',
  inkFaint: '#63636b',
  rule: '#e3e0d7',
  accent: '#17457a',
};

const dark: CurriculumPalette = {
  paper: '#16171b',
  ink: '#eeece6',
  inkQuiet: '#a6a4ac',
  inkFaint: '#8b8992',
  rule: '#2e2f36',
  accent: '#7fa8db',
};

export const defaultTokens: CurriculumTokens = { palettes: { light, dark } };

const CUSTOM_PROPERTY: Record<keyof CurriculumPalette, string> = {
  paper: '--paper',
  ink: '--ink',
  inkQuiet: '--ink-quiet',
  inkFaint: '--ink-faint',
  rule: '--rule',
  accent: '--accent',
};

function declarations(palette: CurriculumPalette): string {
  return (Object.keys(CUSTOM_PROPERTY) as (keyof CurriculumPalette)[])
    .map((key) => `${CUSTOM_PROPERTY[key]}:${palette[key]}`)
    .join(';');
}

/** Injected per request from the snapshot; `data-theme="dark"` overrides light. */
export function stylesheet(tokens: CurriculumTokens): string {
  return [
    `:root{${declarations(tokens.palettes.light)}}`,
    `[data-theme="dark"]{${declarations(tokens.palettes.dark)}}`,
  ].join('');
}
