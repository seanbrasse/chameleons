/*
 * Stage 0 of the component-model bet (docs/CUSTOMIZATION.md).
 *
 * A spike, not production code: the "kit" here emits HTML strings rather than the
 * real React components Stage 1 would build. That is enough to answer the only
 * question Stage 0 exists to answer — can a component TREE express our designs,
 * and does RE-SKINNING one tree with another template's tokens look intentional
 * or just "the same page repainted?"
 *
 * The model under test:
 *   - a `skin` is a token set (colours, fonts, a type scale, spacing);
 *   - a `tree` is a layout of foundational components (stack/grid/text/section),
 *     bound to content, that reads its sizes and tones from the active skin;
 *   - a template = tree + skin. "Switch template" in option C = same tree, new skin.
 *
 * The three panels render:
 *   1. the Dossier tree under the Dossier skin      — dossier, as authored
 *   2. the Dossier tree under the Byline  skin      — RE-SKIN ONLY (what C gives)
 *   3. the Byline  tree under the Byline  skin      — byline, as authored
 * If (2) ≈ (3), a token re-skin is enough and C fully holds. If (2) looks like
 * (1) repainted, structure matters and re-skin alone cannot turn one design into
 * another — the "families" finding.
 */

// ── content (compact, plausible) ────────────────────────────────────────
const content = {
  name: 'Sean Brasse',
  role: 'Software Engineer',
  tagline: 'Frontend engineer who ships the feature nobody wants to own.',
  projects: [
    {
      title: 'SMS Age Gating',
      summary:
        'A verification flow shipped across a React microfrontend, a legacy Dojo app and the PHP monolith, under legal review.',
      impact: 'Unlocked a segment worth ~$50M ARR.',
      tech: ['React', 'PHP', 'TypeScript'],
      date: '2024',
      employer: 'Intuit Mailchimp',
    },
    {
      title: 'Google One-Tap sign-up',
      summary:
        "Built the One-Tap merchant onboarding with Google's team, then traced the iframe bug quietly blocking its launch.",
      impact: 'Projected ~20,000 new merchants a year.',
      tech: ['React', 'Node', 'Jest'],
      date: '2023',
      employer: 'PayPal',
    },
    {
      title: 'Pass the Interview',
      summary:
        'LeetCode you can talk to: think out loud while you code and an AI interviewer pushes back and grades you.',
      impact: '69 problems across DSA, system design and frontend.',
      tech: ['React', 'Pyodide', 'Claude'],
      date: '2026',
      employer: '',
    },
  ],
  metrics: [
    { value: '100K+', label: 'QBO merchants activated' },
    { value: '~$50M', label: 'ARR segment unlocked' },
    { value: '~50%', label: 'Lift in opt-in rate' },
  ],
  experience: [
    { company: 'Intuit Mailchimp', role: 'Software Engineer II', years: '2023 — now' },
    { company: 'PayPal', role: 'Full-Stack Engineer', years: '2022 — 2023' },
  ],
};

// ── the kit: foundational components as HTML, token-driven ───────────────
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const toneVar = { ink: 'var(--ink)', quiet: 'var(--quiet)', faint: 'var(--faint)', accent: 'var(--accent-ink)' };
const fontVar = { display: 'var(--font-display)', body: 'var(--font-body)', mono: 'var(--font-mono)' };

function text(value, o = {}) {
  const {
    size = 16, tone = 'ink', font = 'body', weight = 400,
    spacing = '0', lh = 1.45, transform = 'none', align = 'left', italic = false,
  } = o;
  return `<div style="font-family:${fontVar[font]};font-size:${size}px;color:${toneVar[tone]};font-weight:${weight};letter-spacing:${spacing};line-height:${lh};text-transform:${transform};text-align:${align};font-style:${italic ? 'italic' : 'normal'};">${esc(value)}</div>`;
}
const stack = (gap, kids) =>
  `<div style="display:flex;flex-direction:column;gap:${gap}px;">${kids.filter(Boolean).join('')}</div>`;
const gridCols = (cols, gap, kids) =>
  `<div style="display:grid;grid-template-columns:${cols};gap:${gap}px;align-items:baseline;">${kids.join('')}</div>`;
const rule = () => `<div style="height:1px;background:var(--rule);"></div>`;

function sectionLabel(title, skin) {
  return `<div style="display:flex;align-items:baseline;gap:10px;border-top:2px solid var(--accent);padding-top:8px;">
    ${text(title, { size: skin.type.meta, tone: 'accent', font: skin.labelFont, weight: 600, spacing: '0.1em', transform: skin.labelTransform })}
  </div>`;
}

function frame(skin, body) {
  const c = skin.colors;
  return `<div style="
    --paper:${c.paper};--ink:${c.ink};--quiet:${c.quiet};--faint:${c.faint};--rule:${c.rule};--accent:${c.accent};--accent-ink:${c.accentInk};
    --font-display:${skin.fonts.display};--font-body:${skin.fonts.body};--font-mono:${skin.fonts.mono};
    background:${c.paper};color:${c.ink};font-family:${skin.fonts.body};padding:44px 40px;min-height:760px;">
    <div style="max-width:${skin.measure};margin:0 auto;">${body}</div>
  </div>`;
}

// ── two skins ────────────────────────────────────────────────────────────
const skinDossier = {
  colors: { paper: '#f7f4ee', ink: '#1a1714', quiet: '#575049', faint: '#6c645b', rule: '#e2dccf', accent: '#b3401f', accentInk: '#a3391a' },
  fonts: { display: "'Iowan Old Style', Georgia, 'Times New Roman', serif", body: "Georgia, 'Times New Roman', serif", mono: "ui-monospace, 'SF Mono', Menlo, monospace" },
  type: { name: 46, section: 40, entry: 21, lead: 22, body: 16, meta: 13, micro: 12 },
  space: { sm: 8, md: 16, lg: 28, xl: 44, xxl: 64 },
  measure: '46rem',
  labelFont: 'mono', labelTransform: 'uppercase',
};

const skinByline = {
  colors: { paper: '#fbf9f6', ink: '#211c1f', quiet: '#5c545a', faint: '#6d646b', rule: '#e6e0da', accent: '#8a3d63', accentInk: '#8a3d63' },
  fonts: { display: "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif", body: "'Iowan Old Style', Palatino, Georgia, serif", mono: "ui-sans-serif, system-ui, 'Segoe UI', sans-serif" },
  type: { name: 15, section: 30, entry: 30, lead: 46, body: 18, meta: 14, micro: 13 },
  space: { sm: 8, md: 16, lg: 24, xl: 40, xxl: 56 },
  measure: '40rem',
  labelFont: 'mono', labelTransform: 'uppercase',
};

// ── tree A: the Dossier structure (margin sidenotes, big metrics) ────────
function dossierTree(c, skin) {
  const t = skin.type, s = skin.space;
  const header = stack(s.sm, [
    text(c.name, { size: t.name, font: 'display', weight: 600, spacing: '-0.02em', lh: 1.05 }),
    text(c.role, { size: t.lead, tone: 'quiet' }),
  ]);

  const project = (p) =>
    gridCols('minmax(0,1fr) 180px', s.lg, [
      stack(s.sm, [
        text(p.title, { size: t.entry, font: 'display', weight: 600 }),
        text(p.summary, { size: t.body, tone: 'quiet' }),
        text(p.impact, { size: t.body, tone: 'ink' }),
      ]),
      stack(6, [
        text(p.date, { size: t.micro, tone: 'faint', font: 'mono', align: 'right' }),
        p.employer ? text(p.employer, { size: t.micro, tone: 'faint', font: 'mono', align: 'right' }) : '',
        text(p.tech.join(' · '), { size: t.micro, tone: 'faint', font: 'mono', align: 'right' }),
      ]),
    ]);

  const metric = (m) =>
    stack(4, [
      text(m.value, { size: t.section, font: 'display', weight: 600, tone: 'accent', lh: 1 }),
      text(m.label, { size: t.micro, tone: 'quiet', font: 'mono' }),
    ]);

  const role = (r) =>
    gridCols('minmax(0,1fr) auto', s.md, [
      stack(2, [text(r.company, { size: t.entry, font: 'display', weight: 600 }), text(r.role, { size: t.body, tone: 'quiet' })]),
      text(r.years, { size: t.micro, tone: 'faint', font: 'mono' }),
    ]);

  return stack(s.xxl, [
    header,
    stack(s.md, [sectionLabel('Selected work', skin), stack(s.xl, c.projects.map(project))]),
    stack(s.md, [sectionLabel('By the numbers', skin), `<div style="display:flex;gap:44px;flex-wrap:wrap;">${c.metrics.map(metric).join('')}</div>`]),
    stack(s.md, [sectionLabel('Experience', skin), stack(s.lg, c.experience.map(role))]),
  ]);
}

// ── tree B: the Byline structure (one editorial column, outcome-led) ─────
function bylineTree(c, skin) {
  const t = skin.type, s = skin.space;
  const header = stack(s.md, [
    text(c.role, { size: t.micro, tone: 'accent', font: 'mono', weight: 600, spacing: '0.12em', transform: 'uppercase' }),
    text('By ' + c.name, { size: t.name, font: 'mono', weight: 600 }),
    text(c.tagline, { size: t.lead, lh: 1.2, spacing: '-0.015em' }),
  ]);

  const work = (p) =>
    stack(s.sm, [
      text(p.title, { size: t.entry, font: 'display', weight: 600, lh: 1.15, spacing: '-0.015em' }),
      text(p.impact, { size: 22, tone: 'ink', lh: 1.35 }),
      text(p.summary, { size: t.body, tone: 'quiet' }),
      text(p.date, { size: t.meta, tone: 'faint', font: 'mono' }),
    ]);

  const workList = c.projects
    .map((p) => `<div style="border-bottom:1px solid var(--rule);padding-bottom:${s.xl}px;">${work(p)}</div>`)
    .join(`<div style="height:${s.xl}px;"></div>`);

  const role = (r) =>
    `<div style="display:flex;justify-content:space-between;gap:24px;border-top:1px solid var(--rule);padding:10px 0;">
      ${text(r.role, { size: t.meta, font: 'mono' })}${text(r.company, { size: t.meta, tone: 'quiet', font: 'mono' })}${text(r.years, { size: t.meta, tone: 'faint', font: 'mono' })}
    </div>`;

  return stack(s.xxl, [
    header,
    stack(s.lg, [sectionLabel('Selected work', skin), `<div>${workList}</div>`]),
    stack(s.md, [sectionLabel('Experience', skin), `<div>${c.experience.map(role).join('')}</div>`]),
  ]);
}

// ── page: three panels ───────────────────────────────────────────────────
function panel(caption, sub, inner) {
  return `<div style="display:flex;flex-direction:column;gap:10px;">
    <div style="font:600 13px system-ui;color:#111;">${caption}</div>
    <div style="font:400 12px system-ui;color:#666;max-width:34ch;">${sub}</div>
    <div style="border:1px solid #ddd;border-radius:8px;overflow:hidden;">${inner}</div>
  </div>`;
}

const page = `<!doctype html><html><head><meta charset="utf8"><style>
  body{margin:0;padding:28px;background:#eceae6;}
  .cols{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;align-items:start;}
</style></head><body>
  <div style="font:700 18px system-ui;margin:0 0 4px;">Stage 0 — does a re-skinned tree hold up?</div>
  <div style="font:400 13px system-ui;color:#555;margin:0 0 24px;max-width:80ch;">Same content throughout. Panels 1 and 2 are the identical Dossier <b>tree</b> under two skins; panel 3 is a different <b>tree</b> (Byline's structure) under the same skin as panel 2.</div>
  <div class="cols">
    ${panel('1 · Dossier tree + Dossier skin', 'The design as authored.', frame(skinDossier, dossierTree(content, skinDossier)))}
    ${panel('2 · Dossier tree + Byline skin', 'RE-SKIN ONLY — what option C gives you when you switch template. Same layout, new tokens.', frame(skinByline, dossierTree(content, skinByline)))}
    ${panel('3 · Byline tree + Byline skin', 'Byline as authored — a different structure. This is what the user actually wants "Byline" to look like.', frame(skinByline, bylineTree(content, skinByline)))}
  </div>
</body></html>`;

process.stdout.write(page);
