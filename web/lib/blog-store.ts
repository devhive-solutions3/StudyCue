import 'server-only';

import fs from 'fs';
import matter from 'gray-matter';
import path from 'path';
import { FieldPath } from 'firebase-admin/firestore';

import { getFirebaseAdminDb } from '@/lib/firebase-admin';

export type BlogPostStatus = 'draft' | 'published';

export type ManagedBlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  status: BlogPostStatus;
  author: string;
  createdAt: string | null;
  updatedAt: string | null;
  publishedAt: string | null;
  seoTitle: string;
  seoDescription: string;
  featured: boolean;
};

export type PublicBlogPost = {
  slug: string;
  title: string;
  seoTitle?: string;
  description?: string;
  date: string;
  readingMinutes?: number;
  content: string;
  featured?: boolean;
};

const PRIMARY_BLOG_DIR = path.join(process.cwd(), 'content', 'blog');
const FALLBACK_BLOG_DIR = path.join(process.cwd(), 'web', 'content', 'blog');

function getBlogDir() {
  if (fs.existsSync(PRIMARY_BLOG_DIR)) return PRIMARY_BLOG_DIR;
  return FALLBACK_BLOG_DIR;
}

function normalizeIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  return null;
}

function computeReadingMinutes(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

function normalizeStatus(value: unknown): BlogPostStatus {
  return value === 'published' ? 'published' : 'draft';
}

function buildManagedBlogPost(id: string, data: Record<string, unknown>): ManagedBlogPost {
  return {
    id,
    title: typeof data.title === 'string' ? data.title : 'Untitled post',
    slug: typeof data.slug === 'string' ? data.slug : id,
    excerpt: typeof data.excerpt === 'string' ? data.excerpt : '',
    content: typeof data.content === 'string' ? data.content : '',
    status: normalizeStatus(data.status),
    author: typeof data.author === 'string' ? data.author : '',
    createdAt: normalizeIso(data.createdAt),
    updatedAt: normalizeIso(data.updatedAt),
    publishedAt: normalizeIso(data.publishedAt),
    seoTitle: typeof data.seoTitle === 'string' ? data.seoTitle : '',
    seoDescription: typeof data.seoDescription === 'string' ? data.seoDescription : '',
    featured: Boolean(data.featured),
  };
}

function parseMarkdownPost(slug: string): PublicBlogPost | null {
  const safeSlug = slug.replace(/\.md$/, '').replace(/[^a-z0-9-]/gi, '-');
  const fullPath = path.join(getBlogDir(), `${safeSlug}.md`);
  if (!fs.existsSync(fullPath)) return null;

  const raw = fs.readFileSync(fullPath, 'utf8');
  const parsed = matter(raw);
  const data =
    parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)
      ? (parsed.data as Record<string, unknown>)
      : {};
  const date =
    typeof data.date === 'string' ? data.date : typeof data.updated === 'string' ? data.updated : '';
  if (!date || Boolean(data.draft)) return null;

  return {
    slug: safeSlug,
    title: typeof data.title === 'string' ? data.title : safeSlug,
    seoTitle: typeof data.seoTitle === 'string' ? data.seoTitle : undefined,
    description: typeof data.description === 'string' ? data.description : undefined,
    date,
    readingMinutes: computeReadingMinutes(parsed.content ?? ''),
    content: parsed.content ?? '',
  };
}

function getMarkdownPosts(): PublicBlogPost[] {
  if (!fs.existsSync(getBlogDir())) return [];
  return fs
    .readdirSync(getBlogDir())
    .filter((file) => file.endsWith('.md'))
    .map((file) => parseMarkdownPost(file.replace(/\.md$/, '')))
    .filter((post): post is PublicBlogPost => Boolean(post))
    .sort((a, b) => b.date.localeCompare(a.date));
}

async function getFirestorePublishedPosts(): Promise<PublicBlogPost[]> {
  try {
    const snapshot = await getFirebaseAdminDb()
      .collection('blogPosts')
      .where('status', '==', 'published')
      .get();

    return snapshot.docs
      .map((doc) => buildManagedBlogPost(doc.id, doc.data()))
      .filter((post) => post.publishedAt || post.updatedAt || post.createdAt)
      .map((post) => ({
        slug: post.slug,
        title: post.title,
        seoTitle: post.seoTitle || undefined,
        description: post.seoDescription || post.excerpt || undefined,
        date: post.publishedAt || post.updatedAt || post.createdAt || '',
        readingMinutes: computeReadingMinutes(post.content),
        content: post.content,
        featured: post.featured,
      }))
      .filter((post) => Boolean(post.date))
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

export async function getPublishedBlogPosts(): Promise<PublicBlogPost[]> {
  const [firestorePosts, markdownPosts] = await Promise.all([
    getFirestorePublishedPosts(),
    Promise.resolve(getMarkdownPosts()),
  ]);

  const merged = new Map<string, PublicBlogPost>();
  for (const post of markdownPosts) merged.set(post.slug, post);
  for (const post of firestorePosts) merged.set(post.slug, post);

  return [...merged.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export async function getPublishedBlogPostBySlug(slug: string): Promise<PublicBlogPost | null> {
  const posts = await getPublishedBlogPosts();
  return posts.find((post) => post.slug === slug) ?? null;
}

export async function getAdminBlogPosts(): Promise<ManagedBlogPost[]> {
  try {
    const snapshot = await getFirebaseAdminDb().collection('blogPosts').get();
    return snapshot.docs
      .map((doc) => buildManagedBlogPost(doc.id, doc.data()))
      .sort((a, b) =>
        String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')),
      );
  } catch {
    return [];
  }
}

export async function getAdminBlogPostById(id: string): Promise<ManagedBlogPost | null> {
  if (!id) return null;
  try {
    const snapshot = await getFirebaseAdminDb().collection('blogPosts').doc(id).get();
    if (!snapshot.exists) return null;
    return buildManagedBlogPost(snapshot.id, snapshot.data() ?? {});
  } catch {
    return null;
  }
}

export async function isBlogSlugTaken(slug: string, excludeId?: string): Promise<boolean> {
  const snapshot = await getFirebaseAdminDb()
    .collection('blogPosts')
    .where('slug', '==', slug)
    .get();

  return snapshot.docs.some((doc) => doc.id !== excludeId);
}

export async function findBlogPostBySlug(slug: string): Promise<ManagedBlogPost | null> {
  const snapshot = await getFirebaseAdminDb()
    .collection('blogPosts')
    .where('slug', '==', slug)
    .limit(1)
    .get();
  const first = snapshot.docs[0];
  return first ? buildManagedBlogPost(first.id, first.data()) : null;
}

export async function getRecentPublishedBlogSlugs(): Promise<string[]> {
  const snapshot = await getFirebaseAdminDb()
    .collection('blogPosts')
    .where('status', '==', 'published')
    .select(FieldPath.documentId())
    .get();
  return snapshot.docs.map((doc) => doc.id);
}
