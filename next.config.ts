import type { NextConfig } from 'next';

// Pinned because this app currently lives in a subdirectory of another repo, so
// root inference would walk up to the outer lockfile and pick up its config.
// Harmless to keep once this is extracted to its own repository.
const root = import.meta.dirname;

const config: NextConfig = {
  turbopack: { root },
  outputFileTracingRoot: root,
};

export default config;
