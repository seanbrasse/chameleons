import type { NextConfig } from 'next';

const config: NextConfig = {
  experimental: {
    serverActions: {
      // Autofill submits a résumé through a Server Action, and the default cap
      // is 1MB — under which a plain PDF fits but a CV with a headshot does not,
      // failing at the framework layer with an opaque error before the friendly
      // 4MB check in `draftContent.ts` ever runs. 4.5MB is Vercel's own
      // request-body ceiling, so this raises the app limit to the platform
      // limit and no further.
      bodySizeLimit: '4.5mb',
    },
  },
};

export default config;
