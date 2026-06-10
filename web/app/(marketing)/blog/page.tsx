import type { Metadata } from 'next';
import Link from 'next/link';

import { getPublishedBlogPosts } from '@/lib/blog-store';
import { canonical } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Read original StudyCue Planner guides for weekly schedules, exam preparation, focus sessions, group projects, notes, tasks, and deadlines.',
  alternates: { canonical: canonical('/blog') },
};

export default async function BlogIndexPage() {
  const posts = await getPublishedBlogPosts();
  const featuredPost =
    posts.find((post) => post.featured) ??
    posts.find((post) => post.slug === 'studycue-beta-access') ??
    posts[0] ??
    null;
  const remainingPosts = posts.filter((post) => post.slug !== featuredPost?.slug);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.35em] text-text-muted">Blog</p>
        <h1 className="font-serif text-4xl text-text-primary">StudyCue Planner blog</h1>
      </header>

      <div className="rounded-2xl border border-border bg-surface px-5 py-6 shadow-[var(--sc-shadow-card)]">
        <p className="text-text-secondary">
          StudyCue Planner is a smart study planner for students who want a calmer way to manage schoolwork. These
          guides focus on practical planning: weekly schedules, exam prep, focus sessions, group projects, notes,
          tasks, deadlines, and responsible use of Cue AI.
        </p>
        <p className="mt-4 text-text-secondary">
          Each article is written for real student workflows, including online classes, crowded weeks, and projects
          that require more than a simple to-do list. Related guides link naturally back to StudyCue features where the
          planner can help.
        </p>
      </div>

      {featuredPost ? (
        <section className="rounded-2xl border border-accent/20 bg-surface px-5 py-6 shadow-[var(--sc-shadow-card)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-accent">Featured</p>
          <h2 className="mt-3 text-2xl font-semibold text-text-primary">{featuredPost.title}</h2>
          <p className="mt-3 max-w-2xl text-text-secondary">
            {featuredPost.description}
          </p>
          <Link
            href={`/blog/${featuredPost.slug}`}
            className="mt-5 inline-flex rounded-full border border-accent/20 bg-accent-light px-4 py-2 text-sm font-semibold text-accent transition hover:border-accent/35"
          >
            Read guide
          </Link>
        </section>
      ) : null}

      <section className="rounded-2xl border border-border bg-surface px-5 py-6 shadow-[var(--sc-shadow-card)]">
        <h2 className="text-2xl font-semibold text-text-primary">What you can read here</h2>
        <p className="mt-3 text-text-secondary">
          Expect original posts about active recall, time blocking, class schedule planning, exam preparation, focus
          habits, group project planning, and how to use StudyCue Planner for day-to-day schoolwork.
        </p>
      </section>

      {remainingPosts.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-2">
          {remainingPosts.map((post) => (
            <article
              key={post.slug}
              className="rounded-2xl border border-border bg-surface px-5 py-5 shadow-[var(--sc-shadow-card)]"
            >
              <p className="text-xs text-text-muted">{post.date}</p>
              <h3 className="mt-2 text-xl font-semibold text-text-primary">{post.title}</h3>
              {post.description ? (
                <p className="mt-3 text-sm text-text-secondary">{post.description}</p>
              ) : null}
              <Link
                href={`/blog/${post.slug}`}
                className="mt-4 inline-flex text-sm font-semibold text-accent transition hover:opacity-80"
              >
                Read post
              </Link>
            </article>
          ))}
        </section>
      ) : null}

    </div>
  );
}
