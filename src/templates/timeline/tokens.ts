/**
 * This template's colour vocabulary. Not a shared contract — another template
 * declares whatever set its own design needs, under its own names.
 *
 * Every value in the system lives here; a lint rule fails on a colour literal
 * anywhere else under `src/`.
 */

export const THEMES = ['dark', 'light'] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = 'light';

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

export type Palette = {
  paper: string;
  paperLit: string;
  ink: string;
  matte: string;
  matteShade: string;
  inkMuted: string;
  surface: string;
  surfaceSunk: string;
  rule: string;
  ruleStrong: string;
  accentA: string;
  accentB: string;
  accentC: string;
  screen: string;
  balloon: string;
  onAccent: string;
  onAccentB: string;
  onAccentC: string;
  titleAccent: string;
  railBg: string;
  railFg: string;
  link: string;
  metricShadow: string;
  shadowInk: string;
  focus: string;
  duotoneDark: string;
  duotoneLight: string;
};

export type TimelineTokens = {
  palettes: Record<Theme, Palette>;
};

const dark: Palette = {
  paper: '#0D0D0D',
  paperLit: '#121212',
  ink: '#F1ECE1',
  matte: '#1A1A1A',
  matteShade: '#000000',
  // Cream at reduced presence rather than a grey: a neutral grey against a warm
  // cream reads as a second, dirtier colour.
  inkMuted: '#9C968B',
  surface: '#141414',
  surfaceSunk: '#101010',
  rule: '#242424',
  ruleStrong: '#333333',
  accentA: '#E4693B',
  accentB: '#F1ECE1',
  accentC: '#E4693B',
  screen: '#242424',
  balloon: '#141414',
  onAccent: '#0D0D0D',
  onAccentB: '#0D0D0D',
  onAccentC: '#0D0D0D',
  titleAccent: '#F1ECE1',
  railBg: '#0D0D0D',
  railFg: '#F1ECE1',
  // The ember is under AA on near-black at body size, so links are set in ink
  // and carry an underline.
  link: '#F1ECE1',
  metricShadow: '#0D0D0D',
  shadowInk: '#000000',
  focus: '#E4693B',
  duotoneDark: '#0D0D0D',
  duotoneLight: '#E4693B',
};

const light: Palette = {
  paper: '#F4F1EA',
  paperLit: '#FAF8F3',
  ink: '#141414',
  matte: '#FFFFFF',
  matteShade: '#141414',
  inkMuted: '#5F5A52',
  surface: '#FAF8F3',
  surfaceSunk: '#EDE9E0',
  rule: '#E0DBD1',
  ruleStrong: '#C6C0B4',
  accentA: '#C24A1E',
  accentB: '#141414',
  accentC: '#C24A1E',
  screen: '#E0DBD1',
  balloon: '#FAF8F3',
  onAccent: '#FAF8F3',
  onAccentB: '#FAF8F3',
  onAccentC: '#FAF8F3',
  titleAccent: '#141414',
  railBg: '#141414',
  railFg: '#FAF8F3',
  link: '#141414',
  metricShadow: '#F4F1EA',
  shadowInk: '#141414',
  focus: '#C24A1E',
  duotoneDark: '#141414',
  duotoneLight: '#C24A1E',
};

export const defaultTokens: TimelineTokens = { palettes: { dark, light } };

const CUSTOM_PROPERTY: Record<keyof Palette, string> = {
  paper: '--paper',
  paperLit: '--paper-lit',
  ink: '--ink',
  matte: '--matte',
  matteShade: '--matte-shade',
  inkMuted: '--ink-muted',
  surface: '--surface',
  surfaceSunk: '--surface-sunk',
  rule: '--rule',
  ruleStrong: '--rule-strong',
  accentA: '--accent-a',
  accentB: '--accent-b',
  accentC: '--accent-c',
  screen: '--screen',
  balloon: '--balloon',
  onAccent: '--on-accent',
  onAccentB: '--on-accent-b',
  onAccentC: '--on-accent-c',
  titleAccent: '--title-accent',
  railBg: '--rail-bg',
  railFg: '--rail-fg',
  link: '--link',
  metricShadow: '--metric-shadow',
  shadowInk: '--shadow-ink',
  focus: '--focus',
  duotoneDark: '--duotone-dark',
  duotoneLight: '--duotone-light',
};

function declarations(palette: Palette): string {
  return (Object.keys(CUSTOM_PROPERTY) as (keyof Palette)[])
    .map((key) => `${CUSTOM_PROPERTY[key]}:${palette[key]}`)
    .join(';');
}

/**
 * Injected per request from the published snapshot, so a tenant's chosen palette
 * is present on first paint.
 */
export function stylesheet(tokens: TimelineTokens): string {
  return [
    `:root{${declarations(tokens.palettes.light)}}`,
    `[data-theme="dark"]{${declarations(tokens.palettes.dark)}}`,
  ].join('');
}
