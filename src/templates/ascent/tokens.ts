/**
 * This template's colour vocabulary — eight names, dual-theme, its own values.
 *
 * More names than the document templates because this design has surfaces they
 * do not: a soft-filled "open to" panel and a tag border. Emerald where the
 * others are ember/blue/red/plum, and a warm, forward palette rather than a
 * restrained one — the whole point is that this looks encouraging, not archival
 * (plan §6: a design owns its tokens). Every value lives here; a lint rule fails
 * on a colour literal anywhere else under `src/`.
 *
 * The values are the comp's, after its floor pass: both themes clear WCAG AA,
 * with the faint tone held above 5:1 — the shade a proper-looking margin grey
 * fails.
 */

export type AscentPalette = {
  /** The page. */
  paper: string;
  /** Text. */
  ink: string;
  /** Secondary text — the tagline, project bodies, role notes. */
  inkQuiet: string;
  /** The margin: dates, location, coursework. Quieter, still legible. */
  inkFaint: string;
  /** Hairlines under section titles. */
  rule: string;
  /** Tag outlines — a hair stronger than a rule so a pill reads as bordered. */
  edge: string;
  /** Emerald. The "open to" panel, section titles, links, the availability dot. */
  accent: string;
  /** The soft emerald wash behind the "open to" panel. Never under body text. */
  accentSoft: string;
};

export type AscentTokens = {
  palettes: { light: AscentPalette; dark: AscentPalette };
};

const light: AscentPalette = {
  paper: '#f8faf9',
  ink: '#16201c',
  inkQuiet: '#4f5a54',
  inkFaint: '#616b65',
  rule: '#dfe6e2',
  edge: '#cdd6d0',
  accent: '#0f6b52',
  accentSoft: '#e5f0ea',
};

const dark: AscentPalette = {
  paper: '#131815',
  ink: '#eef2ef',
  inkQuiet: '#a6b0aa',
  inkFaint: '#8a948e',
  rule: '#29302b',
  edge: '#3a423c',
  accent: '#4fd1a5',
  accentSoft: '#1b2620',
};

export const defaultTokens: AscentTokens = { palettes: { light, dark } };

const CUSTOM_PROPERTY: Record<keyof AscentPalette, string> = {
  paper: '--paper',
  ink: '--ink',
  inkQuiet: '--ink-quiet',
  inkFaint: '--ink-faint',
  rule: '--rule',
  edge: '--edge',
  accent: '--accent',
  accentSoft: '--accent-soft',
};

function declarations(palette: AscentPalette): string {
  return (Object.keys(CUSTOM_PROPERTY) as (keyof AscentPalette)[])
    .map((key) => `${CUSTOM_PROPERTY[key]}:${palette[key]}`)
    .join(';');
}

/** Injected per request from the snapshot; `data-theme="dark"` overrides light. */
export function stylesheet(tokens: AscentTokens): string {
  return [
    `:root{${declarations(tokens.palettes.light)}}`,
    `[data-theme="dark"]{${declarations(tokens.palettes.dark)}}`,
  ].join('');
}
