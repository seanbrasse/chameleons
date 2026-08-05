/**
 * This template's colour vocabulary — six names, dual-theme.
 *
 * Templates share a floor, not a design system (plan §6): a design declares
 * whatever set it actually uses, so `dossier` needs about a third of `timeline`'s
 * twenty-seven. Every value lives here; a lint rule fails on a colour literal
 * anywhere else under `src/`, which is why the dark palette is a second object
 * here rather than a `[data-theme]` block of hex in the stylesheet.
 *
 * The values are the ones the comp shipped with, after its floor pass corrected
 * the margin column: the first draft set sidenotes at a ratio that *looked* like
 * a proper margin note and failed WCAG AA on 21 nodes, and the sidenote is the
 * most characteristic thing in the design. Both themes are above 5:1 now.
 */

export type DossierPalette = {
  /** The page. */
  paper: string;
  /** Text. */
  ink: string;
  /** Secondary text — leads, roles, numeral captions. */
  inkQuiet: string;
  /** The margin column: quieter still, but a note has to stay legible. */
  inkFaint: string;
  /** Hairlines and the colophon rule. */
  rule: string;
  /** Printer's red. Two jobs only: the metric numerals and the section rules. */
  accent: string;
};

export type DossierTokens = { palettes: { light: DossierPalette; dark: DossierPalette } };

const light: DossierPalette = {
  paper: '#faf8f4',
  ink: '#17161a',
  inkQuiet: '#57545e',
  inkFaint: '#63606b',
  rule: '#ddd7cc',
  accent: '#b3311c',
};

const dark: DossierPalette = {
  paper: '#14131a',
  ink: '#f2efe9',
  inkQuiet: '#a5a1ab',
  inkFaint: '#8b8796',
  rule: '#322f3a',
  accent: '#ff6a4d',
};

export const defaultTokens: DossierTokens = { palettes: { light, dark } };

const CUSTOM_PROPERTY: Record<keyof DossierPalette, string> = {
  paper: '--paper',
  ink: '--ink',
  inkQuiet: '--ink-quiet',
  inkFaint: '--ink-faint',
  rule: '--rule',
  accent: '--accent',
};

function declarations(palette: DossierPalette): string {
  return (Object.keys(CUSTOM_PROPERTY) as (keyof DossierPalette)[])
    .map((key) => `${CUSTOM_PROPERTY[key]}:${palette[key]}`)
    .join(';');
}

/**
 * Injected per request from the snapshot, so the palette is there on first
 * paint. Light is the base; `data-theme="dark"` overrides it, matching the
 * attribute `ThemeScript` sets before paint.
 */
export function stylesheet(tokens: DossierTokens): string {
  return [
    `:root{${declarations(tokens.palettes.light)}}`,
    `[data-theme="dark"]{${declarations(tokens.palettes.dark)}}`,
  ].join('');
}
