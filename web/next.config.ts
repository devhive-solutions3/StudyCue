import type { NextConfig } from 'next';

import { bridgedPublicEnvForNextConfig } from './lib/public-env';

const nextConfig: NextConfig = {
  /** Expose EXPO_PUBLIC_* (Vercel) + NEXT_PUBLIC_* (local) to client bundles. */
  env: bridgedPublicEnvForNextConfig(),
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
