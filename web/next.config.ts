import type { NextConfig } from 'next';

import { bridgedPublicEnvForNextConfig } from './lib/public-env';

const nextConfig: NextConfig = {
  /** Expose EXPO_PUBLIC_* (Vercel) + NEXT_PUBLIC_* (local) to client bundles. */
  env: bridgedPublicEnvForNextConfig(),
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
