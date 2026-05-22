import type { MetadataRoute } from 'next';

import { resolveSiteOrigin } from '@/lib/site-config';

export default function robots(): MetadataRoute.Robots {
  const base = resolveSiteOrigin();

  return {
    rules: {
      userAgent: '*',
      allow: ['/'],
      disallow: ['/app', '/login', '/register', '/forgot-password', '/api/session'],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
