import type { MetadataRoute } from 'next';

import { PRODUCTION_CANONICAL_ORIGIN } from '@/lib/seo-config';

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    '/',
    '/features',
    '/blog',
    '/contact',
    '/help',
    '/privacy',
    '/terms',
    '/cookies',
  ];

  return paths.map((path) => ({
    url: `${PRODUCTION_CANONICAL_ORIGIN}${path === '/' ? '' : path}`,
    priority: path === '/' ? 1 : 0.65,
    lastModified: new Date(),
  }));
}
