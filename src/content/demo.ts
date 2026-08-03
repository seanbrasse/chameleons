/**
 * Phase 0: the content, written before the layout.
 *
 * Every string here is real and sourced from Sean's resume. Nothing is
 * placeholder prose. When Phase 2 lands, this module is replaced by Supabase
 * queries returning the same shapes — that is the only change the rendering
 * layer should ever see, which is why the panels below reference content by
 * id rather than embedding it.
 *
 * Two deliberate absences, both of which are content decisions rather than
 * missing code:
 *
 *   1. `testimonials` is empty. The PRD's `approved` flag exists precisely so
 *      that a quote nobody has cleared cannot reach the page, and inventing a
 *      quote to fill a panel would be the single worst thing this project
 *      could ship. The testimonial panel is built and tested; it renders the
 *      moment a real, cleared quote is added here.
 *
 *   2. Project `images` are empty. Screenshots are the one input that cannot
 *      be derived from a resume. The image pipeline (duotone, focal point,
 *      theme response) is built; project panels render an inked blank until a
 *      file lands, which is COMP-4 behavior, not a broken state.
 */

import type { Issue } from './types';

const settings: Issue['settings'] = {
  displayName: 'Sean Brasse',
  tagline: 'Frontend engineer who ships the feature nobody wants to own.',
  // Employed and not urgently looking, but open to the right conversation.
  availabilityStatus: 'selective',
  rolesOpenTo: ['Senior Frontend', 'Full Stack'],
  // Each of these is carried by something else in this file: React and
  // TypeScript by the Mailchimp and Avarint work, PHP and Dojo by Mailchimp's
  // summary, Jest by the PayPal bullet, and the rest by the projects' tech.
  skills: [
    'React',
    'TypeScript',
    'Node',
    'PHP',
    'Swift',
    'Python',
    'Supabase',
    'Jest',
  ],
  location: 'New York, NY',
  contactEmail: 'seanbrasse@gmail.com',
  // MEDIA-6: stable path so links in old applications never rot.
  resumeHref: '/resume.pdf',
  links: [
    { label: 'LinkedIn', url: 'https://linkedin.com/in/seanbrasse' },
    { label: 'GitHub', url: 'https://github.com/seanbrasse' },
  ],
  ogTagline: 'Software Engineer II at Intuit Mailchimp. React, TypeScript, and the parts of the stack nobody else will touch.',
  ogSubtitle: 'Software Engineer · React · TypeScript',
};

const experiences: Issue['experiences'] = [
  {
    id: 'mailchimp',
    company: 'Intuit Mailchimp',
    role: 'Software Engineer II',
    location: 'New York, NY',
    startDate: '2023-04',
    endDate: null,
    summary:
      'Forms and SMS platform. Features here ship across a React microfrontend, a legacy Dojo app, and the PHP monolith — often all three at once, often under legal review.',
    impactBullets: [
      'Shipped SMS Age Gating across three stacks, unlocking a segment worth ~$50M ARR under strict legal constraint',
      'Lifted customer opt-in rates ~50% by replacing the legacy Reply-Y step with an onsite verification flow',
      'Core engineer on a greenfield form builder for QuickBooks Online — 100K+ merchants activated in three months',
    ],
  },
  {
    id: 'paypal',
    company: 'PayPal',
    role: 'Full-Stack Software Engineer',
    location: 'New York, NY',
    startDate: '2022-07',
    endDate: '2023-02',
    summary:
      "Merchant onboarding. Built the Google One-Tap sign-up integration alongside Google's engineers, then found the mobile bug that was quietly blocking its launch.",
    impactBullets: [
      "Shipped Google One-Tap sign-up with Google's team, projected to add ~20,000 new merchants annually",
      'Traced a cross-browser iframe sizing bug that blocked input on mobile, unblocking the One-Tap launch',
      'Wired a Jest suite into Jenkins CI, lifting merchant onboarding coverage ~40%',
    ],
  },
  {
    id: 'avarint',
    company: 'Avarint',
    role: 'Software Engineer',
    location: 'Buffalo, NY',
    startDate: '2021-09',
    endDate: '2022-07',
    summary:
      'Aerospace defense modeling. Rebuilt DIADS — a ten-year-old simulator for sensors tracking incoming aircraft — with a seven-person team, so it finally ran in a browser.',
    impactBullets: [
      'Rebuilt a 10-year-old defense modeling codebase in React with a seven-person team',
      'Led the landing page redesign, cutting new-user onboarding time 30%',
    ],
  },
];

const projects: Issue['projects'] = [
  {
    id: 'knowledge-engine',
    status: 'shipped',
    duration: '',
    title: 'LLM Knowledge Engine',
    context: 'professional',
    experienceId: 'mailchimp',
    summary:
      'Ingests merged PRs and their linked Jira tickets into a searchable changelog, with a RAG layer so you can ask it questions in plain English.',
    impact: 'Demoed to engineering leadership as V1 of an internal AI platform',
    tech: ['Python', 'RAG', 'Claude', 'Jira API'],
    links: [],
    images: [],
    date: '2026-01',
  },
  {
    id: 'pass-the-interview',
    status: 'shipped',
    duration: '',
    title: 'Pass the Interview',
    context: 'personal',
    summary:
      'LeetCode you can talk to. Think out loud while you code and an AI interviewer listens, pushes back, and grades you — in speech and in writing.',
    impact: '69 problems across DSA, system design, OOD, backend, and frontend',
    tech: ['React', 'Pyodide', 'Web Speech API', 'Claude', 'Supabase'],
    links: [{ label: 'passtheinterview.dev', url: 'https://passtheinterview.dev', type: 'live' }],
    images: [],
    date: '2026-07',
  },
  {
    id: 'cadence',
    status: 'building',
    duration: '',
    title: 'Cadence',
    context: 'personal',
    summary:
      'Consistency-first fitness tracker. Native SwiftUI with an offline-first SwiftData store and read-only Apple Health sync for sleep, weight, and nutrition.',
    impact: 'Agentic coach that logs your weight and edits your split from chat',
    tech: ['Swift', 'SwiftUI', 'SwiftData', 'HealthKit', 'Supabase', 'Claude'],
    links: [],
    images: [],
    date: '2026-07',
  },
  {
    id: 'life-os',
    status: 'building',
    duration: '',
    title: 'JARVIS Life OS',
    context: 'personal',
    summary:
      'Cross-device life tracking PWA. Goal gauges, a backfillable timeline, Apple Health ingest, and an accountability engine that writes you a review each night.',
    impact: 'Nightly reviews written by Claude, delivered as web push',
    tech: ['React', 'Supabase', 'Claude', 'Vercel', 'PWA'],
    images: [],
    links: [],
    date: '2026-07',
  },
];

const metrics: Issue['metrics'] = [
  { id: 'qbo-merchants', value: '100K+', label: 'QBO merchants activated' },
  { id: 'arr-unlocked', value: '~$50M', label: 'ARR segment unlocked' },
  { id: 'optin-lift', value: '~50%', label: 'Lift in customer opt-in rate' },
];

/**
 * See the note at the top of this file. Adding an entry here with
 * `approved: false` is the correct way to park a quote you have asked for but
 * not yet had cleared — it will not render.
 */
const testimonials: Issue['testimonials'] = [];

/**
 * Where the timeline starts.
 *
 * A list rather than the single record this used to be on `settings`. One
 * school is the common case, not the only one, and the old shape could not say
 * "and then a master's" without a schema change.
 *
 * No end date, because the resume gives a school and a degree and not the year
 * it finished — an inferred graduation date would read as fact on the page.
 * The timeline prints 'from Sep 2017' rather than a range while it is missing,
 * which claims only what is known; entering one in the admin turns it into a
 * range. No location for the same reason: the field exists, the resume does
 * not fill it, and the timeline does not render it.
 *
 * No logo either: a university crest is a trademark like any other mark, so it
 * belongs to whoever uploads it having checked they may.
 */
const education: Issue['education'] = [
  {
    id: 'education',
    school: 'University at Buffalo',
    credential: 'B.S. Computer Science',
    location: '',
    // The year is Sean's; the month is an assumption — September is when a US
    // academic year starts. One field to correct if it was a spring intake.
    startDate: '2017-09',
    endDate: null,
    links: [],
  },
];

export const issue: Issue = {
  settings,
  education,
  experiences,
  projects,
  testimonials,
  metrics,
};
