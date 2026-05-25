import fs from 'fs';
import matter from 'gray-matter';
import path from 'path';

export type BlogPostMeta = Omit<BlogPost, 'content'>;

export type BlogPost = {
  slug: string;
  title: string;
  seoTitle?: string;
  description?: string;
  date: string;
  readingMinutes?: number;
  content: string;
  draft?: boolean;
};

const PRIMARY_BLOG_DIR = path.join(process.cwd(), 'content', 'blog');
const FALLBACK_BLOG_DIR = path.join(process.cwd(), 'web', 'content', 'blog');

function getBlogDir() {
  if (fs.existsSync(PRIMARY_BLOG_DIR)) return PRIMARY_BLOG_DIR;
  return FALLBACK_BLOG_DIR;
}

export function blogDirExists(): boolean {
  return fs.existsSync(getBlogDir());
}

function buildPost(slug: string, content: string, data: Record<string, unknown>): BlogPost {
  const title = typeof data.title === 'string' ? data.title : slug;
  const seoTitle = typeof data.seoTitle === 'string' ? data.seoTitle : undefined;
  const description = typeof data.description === 'string' ? data.description : undefined;
  const date =
    typeof data.date === 'string' ? data.date : typeof data.updated === 'string' ? data.updated : '';
  const draft = Boolean(data.draft);
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  const readingMinutes = Math.max(1, Math.round(words / 220));

  return {
    slug,
    title,
    seoTitle,
    description,
    date,
    readingMinutes,
    content,
    draft,
  };
}

export function parsePostSlug(slug: string): BlogPost | null {
  const safeSlug = slug.replace(/\.md$/, '').replace(/[^a-z0-9-]/gi, '-');
  const fullPath = path.join(getBlogDir(), `${safeSlug}.md`);
  if (!fs.existsSync(fullPath)) return null;

  const raw = fs.readFileSync(fullPath, 'utf8');
  const parsed = matter(raw);
  const data =
    parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)
      ? (parsed.data as Record<string, unknown>)
      : {};

  return buildPost(safeSlug, parsed.content ?? '', data);
}

export function getAllPosts(): BlogPost[] {
  if (!blogDirExists()) return [];
  return fs
    .readdirSync(getBlogDir())
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''))
    .map((slug) => parsePostSlug(slug))
    .filter((p): p is BlogPost => Boolean(p?.date))
    .filter((p) => !p.draft)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getPostBySlug(slug: string): BlogPost | null {
  const post = parsePostSlug(slug);
  if (!post || post.draft || !post.date) return null;
  return post;
}
