import type { MetadataRoute } from 'next';

import { getSiteUrl } from '@/lib/site-config';

export default function robots(): MetadataRoute.Robots {
  const base =
    getSiteUrl()?.replace(/\/+$/, '') ||
    (process.env.NODE_ENV === 'production' ? 'https://study-cue-gamma.vercel.app' : 'http://localhost:3000');

  return {
    rules: {
      userAgent: '*',
      allow: ['/'],
      disallow: ['/app', '/login', '/register', '/forgot-password', '/api/session'],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
