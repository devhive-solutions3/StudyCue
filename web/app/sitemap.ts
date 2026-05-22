import type { MetadataRoute } from 'next';

import { getAllPosts } from '@/lib/posts';
import { getSiteUrl } from '@/lib/site-config';

function absBase(): string {
  const u = getSiteUrl();
  if (u) return u.replace(/\/+$/, '');
  return process.env.NODE_ENV === 'production'
    ? 'https://study-cue-gamma.vercel.app'
    : 'http://localhost:3000';
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = absBase();

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
