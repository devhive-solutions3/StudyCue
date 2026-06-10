import type { MetadataRoute } from 'next';

import { PRODUCTION_CANONICAL_ORIGIN } from '@/lib/seo-config';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/features', '/pricing', '/blog', '/help', '/contact', '/privacy', '/terms', '/cookies'],
      disallow: [
        '/app',
        '/admin',
        '/api/admin',
        '/login',
        '/register',
        '/forgot-password',
        '/auth/action',
        '/api/session',
      ],
    },
    sitemap: `${PRODUCTION_CANONICAL_ORIGIN}/sitemap.xml`,
  };
}
