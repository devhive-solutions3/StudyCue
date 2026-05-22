import type { MetadataRoute } from 'next';

import { getAllPosts } from '@/lib/posts';
import { resolveSiteOrigin } from '@/lib/site-config';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = resolveSiteOrigin();

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

  const staticEntries = paths.map((path) => ({
    url: `${base}${path}`,
    priority: path === '/' ? 1 : 0.65,
    lastModified: new Date(),
  }));

  const posts = getAllPosts().map((p) => ({
    url: `${base}/blog/${p.slug}`,
    lastModified: new Date(p.date),
    priority: 0.7,
  }));

  return [...staticEntries, ...posts];
}
