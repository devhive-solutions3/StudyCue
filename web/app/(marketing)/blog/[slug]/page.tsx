import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import AdSenseSlot from '@/components/ads/AdSenseSlot';
import JsonLd from '@/components/seo/JsonLd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { getAllPosts, getPostBySlug } from '@/lib/posts';
import { canonical, getSiteUrl, siteTitle } from '@/lib/site-config';

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const slug = decodeURIComponent((await props.params).slug);
  const post = getPostBySlug(slug);
  if (!post) return { title: siteTitle };

  const url = canonical(`/blog/${post.slug}`);
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: url },
    openGraph: { type: 'article', title: post.title, url },
  };
}

export default async function BlogArticlePage(props: { params: Promise<{ slug: string }> }) {
  const slug = decodeURIComponent((await props.params).slug);
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const publisherUrl = getSiteUrl() || canonical('/');
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description ?? '',
    datePublished: post.date,
    url: canonical(`/blog/${post.slug}`),
    publisher: {
      '@type': 'Organization',
      name: 'StudyCue',
      url: publisherUrl,
    },
  };

  return (
    <article className="mx-auto max-w-3xl text-text-primary">
      <JsonLd data={ld as unknown as Record<string, unknown>} />
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.35em] text-text-muted">{post.date}</p>
        <h1 className="font-serif text-4xl leading-tight">{post.title}</h1>
      </header>
      <AdSenseSlot compact className="mt-6" />
      <div className="mt-8 space-y-4 text-[1rem] leading-7 text-text-secondary [&_h2]:mt-8 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:text-text-primary [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-8">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
      </div>
    </article>
  );
}
