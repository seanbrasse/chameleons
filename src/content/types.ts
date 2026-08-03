export type AvailabilityStatus = 'open' | 'selective' | 'not_looking';

export type LinkType = 'live' | 'repo' | 'case_study' | 'press';

export type Link = {
  label: string;
  url: string;
  type?: LinkType;
};

export type AssetTreatment = 'duotone' | 'grayscale' | 'none';

export type Asset = {
  id: string;
  src: string;
  media?: 'image' | 'video';
  /** Video only: a still shown before the clip loads. */
  poster?: string;
  alt: string;
  width: number;
  height: number;
  kind: 'screenshot' | 'logo' | 'avatar' | 'document';
  /** How the image sits in a fixed well. Undefined means `contain`. */
  fit?: 'cover' | 'contain';
  /** Magnification from the focal point. Undefined means 1. */
  scale?: number;
  /** The point that must survive a crop, 0..1 in both axes. */
  focalPoint?: { x: number; y: number };
  /** Video only. `false` disables the mute toggle rather than offering an unmute that would do nothing. */
  hasAudio?: boolean;
  treatment?: AssetTreatment;
};

export type SiteSettings = {
  displayName: string;
  tagline: string;
  availabilityStatus: AvailabilityStatus;
  rolesOpenTo: string[];
  skills: string[];
  location: string;
  contactEmail: string;
  resumeHref: string;
  links: Link[];
  /** The description beside the social card, not on it. */
  ogTagline: string;
  /** The subtitle drawn on the social card itself. Stored in natural case. */
  ogSubtitle: string;
};

/**
 * A school. Not an `Experience`: no role, no impact bullets, and no project
 * points at one as the employer it was built at.
 */
export type Education = {
  id: string;
  school: string;
  credential: string;
  location: string;
  /** ISO yyyy-mm. */
  startDate: string;
  /** ISO yyyy-mm. Null means still enrolled. */
  endDate: string | null;
  logo?: Asset;
  links: Link[];
};

export type Experience = {
  id: string;
  company: string;
  role: string;
  location: string;
  /** ISO yyyy-mm. */
  startDate: string;
  /** ISO yyyy-mm. Null means current. */
  endDate: string | null;
  summary: string;
  impactBullets: string[];
  logo?: Asset;
  media?: Asset[];
  links?: Link[];
};

/** `shipped` is the default and does not render — a badge saying "finished" on every card is wallpaper. */
export type ProjectStatus = 'shipped' | 'building' | 'archived';

export type Project = {
  id: string;
  title: string;
  context: 'professional' | 'personal';
  experienceId?: string;
  summary: string;
  /** The fuller write-up under the summary in an opened card. */
  story?: string;
  impact: string;
  status: ProjectStatus;
  duration: string;
  tech: string[];
  links: Link[];
  images: Asset[];
  /** ISO yyyy-mm. */
  date: string;
  starred?: boolean;
};

export type Testimonial = {
  id: string;
  quote: string;
  authorName: string;
  authorRole: string;
  authorCompany: string;
  experienceId?: string;
  approved: boolean;
  typeOn?: boolean;
};

export type Metric = {
  id: string;
  value: string;
  label: string;
};

export type Issue = {
  settings: SiteSettings;
  education: Education[];
  experiences: Experience[];
  projects: Project[];
  testimonials: Testimonial[];
  metrics: Metric[];
};

export const CAPS = {
  experienceSummary: 200,
  impactBullet: 120,
  impactBulletCount: 3,
  projectSummary: 500,
  projectStory: 5000,
  quote: 180,
  tagline: 180,
  /** Measured as the joined string, because the row wraps as one run. */
  skills: 200,
  ogTagline: 300,
  ogSubtitle: 64,
  comment: 500,
} as const;
