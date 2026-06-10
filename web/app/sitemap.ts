import type { MetadataRoute } from 'next';

import { getPublishedBlogPosts } from '@/lib/blog-store';
import { PRODUCTION_CANONICAL_ORIGIN } from '@/lib/seo-config';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getPublishedBlogPosts();
  const paths = [
    '/',
    '/features',
    '/pricing',
    '/blog',
    '/contact',
    '/help',
    '/privacy',
    '/terms',
    '/cookies',
  ];

  const pages = paths.map((path) => ({
    url: `${PRODUCTION_CANONICAL_ORIGIN}${path === '/' ? '' : path}`,
    priority: path === '/' ? 1 : 0.65,
    lastModified: new Date(),
  }));

  const blogPosts = posts.map((post) => ({
    url: `${PRODUCTION_CANONICAL_ORIGIN}/blog/${post.slug}`,
    priority: 0.55,
    lastModified: new Date(post.date),
  }));

  return [...pages, ...blogPosts];
}
