import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import GoogleAdSenseAd from '@/components/ads/GoogleAdSenseAd';
import JsonLd from '@/components/seo/JsonLd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { getPublishedBlogPostBySlug } from '@/lib/blog-store';
import { canonical, siteTitle } from '@/lib/site-config';
import { PRODUCTION_CANONICAL_ORIGIN, siteName } from '@/lib/seo-config';

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const slug = decodeURIComponent((await props.params).slug);
  const post = await getPublishedBlogPostBySlug(slug);
  if (!post) return { title: siteTitle };

  const url = canonical(`/blog/${post.slug}`);
  return {
    title: post.seoTitle ?? post.title,
    description: post.description,
    alternates: { canonical: url },
    openGraph: { type: 'article', title: post.seoTitle ?? post.title, url },
  };
}

export default async function BlogArticlePage(props: { params: Promise<{ slug: string }> }) {
  const slug = decodeURIComponent((await props.params).slug);
  const post = await getPublishedBlogPostBySlug(slug);
  if (!post) notFound();

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description ?? '',
    datePublished: post.date,
    url: canonical(`/blog/${post.slug}`),
    publisher: {
      '@type': 'Organization',
      name: siteName,
      url: PRODUCTION_CANONICAL_ORIGIN,
    },
  };

  return (
    <article className="mx-auto max-w-3xl text-text-primary">
      <JsonLd data={ld as unknown as Record<string, unknown>} />
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.35em] text-text-muted">{post.date}</p>
        <h1 className="font-serif text-4xl leading-tight">{post.title}</h1>
      </header>
      <GoogleAdSenseAd className="mt-8" />
      <div className="mt-8 space-y-4 text-[1rem] leading-7 text-text-secondary [&_h2]:mt-8 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:text-text-primary [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-8">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
      </div>
    </article>
  );
}
