/**
 * This template's colour vocabulary — eight names, dual-theme, its own values.
 *
 * Two names the text templates do not have — `plateFrame` (the hairline around
 * an image band) and `onAccent` (text on the violet closing block) — because
 * folio has surfaces they do not: full-bleed plates and one saturated colour
 * field. Electric violet, the one vivid hue unused across timeline/plates/
 * dossier/curriculum/byline/ascent, so folio can never be mistaken for another
 * template in a different ink (plan §6). Every value lives here; a lint rule
 * fails on a colour literal anywhere else under `src/`.
 *
 * The values are the comp's, after its floor pass: both themes clear WCAG AA,
 * with the faint label tone held above 5:1 and white-on-violet above 9:1.
 */

export type FolioPalette = {
  /** The page. */
  paper: string;
  /** Display type and headings. */
  ink: string;
  /** Premises and secondary prose. */
  inkQuiet: string;
  /** Mono labels, tags, figure captions, years. Quieter, still legible. */
  inkFaint: string;
  /** Hairlines between credits and awards, under each kicker. */
  rule: string;
  /** The frame around an image band, and the fill of a plate with no image yet. */
  plateFrame: string;
  /** Electric violet. Numbers, links, tag bullets, the surname, the closing field. */
  accent: string;
  /** Text on the violet closing block — the one place ink would vanish. */
  onAccent: string;
};

export type FolioTokens = {
  palettes: { light: FolioPalette; dark: FolioPalette };
};

const light: FolioPalette = {
  paper: '#f6f4ef',
  ink: '#141216',
  inkQuiet: '#4a4750',
  inkFaint: '#605c66',
  rule: '#ddd8cf',
  plateFrame: '#e7e2d9',
  accent: '#6420e6',
  onAccent: '#ffffff',
};

const dark: FolioPalette = {
  paper: '#111013',
  ink: '#f1eee8',
  inkQuiet: '#b6b2ba',
  inkFaint: '#918d97',
  rule: '#2b2930',
  plateFrame: '#1d1b21',
  accent: '#b79bff',
  onAccent: '#16121f',
};

export const defaultTokens: FolioTokens = { palettes: { light, dark } };

const CUSTOM_PROPERTY: Record<keyof FolioPalette, string> = {
  paper: '--paper',
  ink: '--ink',
  inkQuiet: '--ink-quiet',
  inkFaint: '--ink-faint',
  rule: '--rule',
  plateFrame: '--plate-frame',
  accent: '--accent',
  onAccent: '--on-accent',
};

function declarations(palette: FolioPalette): string {
  return (Object.keys(CUSTOM_PROPERTY) as (keyof FolioPalette)[])
    .map((key) => `${CUSTOM_PROPERTY[key]}:${palette[key]}`)
    .join(';');
}

/** Injected per request from the snapshot; `data-theme="dark"` overrides light. */
export function stylesheet(tokens: FolioTokens): string {
  return [
    `:root{${declarations(tokens.palettes.light)}}`,
    `[data-theme="dark"]{${declarations(tokens.palettes.dark)}}`,
  ].join('');
}
