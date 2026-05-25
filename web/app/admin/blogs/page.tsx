import Link from 'next/link';

import ConfirmSubmitButton from '@/components/admin/ConfirmSubmitButton';
import {
  deleteBlogPostAction,
  readAdminDataSourceStatus,
  readAdminBlogs,
  saveBlogPostAction,
  toggleBlogFeaturedAction,
  toggleBlogPublishAction,
} from '@/lib/admin-data';
import { formatAdminDate } from '@/lib/admin-shared';
import { getAdminBlogPostById } from '@/lib/blog-store';

export default async function AdminBlogsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const dataSource = readAdminDataSourceStatus();
  const searchParams = await props.searchParams;
  const editId = typeof searchParams.edit === 'string' ? searchParams.edit : '';
  const posts = await readAdminBlogs();
  const editingPost = editId ? await getAdminBlogPostById(editId) : null;

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-white/10 bg-white/5 px-6 py-5 backdrop-blur-xl dark:border-white/8 dark:bg-white/6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">Admin / Blogs</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-text-primary">Blog manager</h1>
            <p className="mt-2 text-sm text-text-secondary">
              Firestore-backed editorial workflow for creating, editing, publishing, featuring, and deleting StudyCue posts.
            </p>
          </div>
          <Link
            href="/admin/blogs"
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-accent/20 bg-accent/12 px-4 text-sm font-semibold text-accent transition hover:border-accent/35"
          >
            New post
          </Link>
        </div>
      </div>

      {!dataSource.configured ? (
        <div className="rounded-[24px] border border-amber-400/25 bg-amber-500/10 px-6 py-5 text-sm text-amber-100/90">
          Firebase Admin credentials are not configured. Blog posts can still show from markdown fallback publicly, but Firestore-backed admin editing requires server-side admin credentials.
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <section className="overflow-hidden rounded-[26px] border border-white/10 bg-white/5 shadow-[0_18px_48px_rgba(9,12,35,0.16)] backdrop-blur-xl dark:border-white/8 dark:bg-white/6">
          <div className="border-b border-white/8 px-5 py-4">
            <h2 className="text-base font-bold text-text-primary">Posts</h2>
          </div>
          {posts.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-base font-semibold text-text-primary">No blog posts yet.</p>
              <p className="mt-2 text-sm text-text-secondary">
                Use the editor to create the first post.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-black/10 text-xs uppercase tracking-[0.2em] text-text-muted">
                  <tr>
                    <th className="px-4 py-3">Post</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post) => (
                    <tr key={post.id} className="border-t border-white/8 text-text-secondary">
                      <td className="px-4 py-4 align-top">
                        <div className="font-semibold text-text-primary">{post.title}</div>
                        <div className="mt-1 text-xs text-text-muted">{post.slug}</div>
                        <div className="mt-2 text-xs text-text-secondary">{post.excerpt || 'No excerpt yet.'}</div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span className="inline-flex rounded-full border border-white/10 bg-black/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-text-primary">
                          {post.status}
                        </span>
                        {post.featured ? (
                          <div className="mt-2 text-xs font-semibold text-accent">Featured</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 align-top">{formatAdminDate(post.updatedAt)}</td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/admin/blogs?edit=${post.id}`}
                            className="rounded-full border border-white/10 bg-black/10 px-3 py-1.5 text-xs font-semibold text-text-primary transition hover:border-accent/25"
                          >
                            Edit
                          </Link>
                          <form action={toggleBlogPublishAction}>
                            <input type="hidden" name="postId" value={post.id} />
                            <input type="hidden" name="nextStatus" value={post.status === 'published' ? 'draft' : 'published'} />
                            <button
                              type="submit"
                              className="rounded-full border border-white/10 bg-black/10 px-3 py-1.5 text-xs font-semibold text-text-primary transition hover:border-accent/25"
                            >
                              {post.status === 'published' ? 'Unpublish' : 'Publish'}
                            </button>
                          </form>
                          <form action={toggleBlogFeaturedAction}>
                            <input type="hidden" name="postId" value={post.id} />
                            <input type="hidden" name="featured" value={post.featured ? 'false' : 'true'} />
                            <button
                              type="submit"
                              className="rounded-full border border-white/10 bg-black/10 px-3 py-1.5 text-xs font-semibold text-text-primary transition hover:border-accent/25"
                            >
                              {post.featured ? 'Unfeature' : 'Feature'}
                            </button>
                          </form>
                          <form action={deleteBlogPostAction}>
                            <input type="hidden" name="postId" value={post.id} />
                            <ConfirmSubmitButton
                              confirmMessage={`Delete "${post.title}"? This cannot be undone.`}
                              className="rounded-full border border-rose-500/25 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-400 transition hover:border-rose-500/40"
                            >
                              Delete
                            </ConfirmSubmitButton>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-[26px] border border-white/10 bg-white/5 p-5 shadow-[0_18px_48px_rgba(9,12,35,0.16)] backdrop-blur-xl dark:border-white/8 dark:bg-white/6">
          <h2 className="text-base font-bold text-text-primary">
            {editingPost ? `Edit: ${editingPost.title}` : 'Create post'}
          </h2>
          <form action={saveBlogPostAction} className="mt-5 space-y-4">
            <input type="hidden" name="postId" defaultValue={editingPost?.id ?? ''} />
            <div>
              <label className="text-sm font-semibold text-text-primary">Title</label>
              <input
                name="title"
                required
                defaultValue={editingPost?.title ?? ''}
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/10 px-4 text-sm text-text-primary outline-none transition focus:border-accent/35"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-text-primary">Slug</label>
              <input
                name="slug"
                defaultValue={editingPost?.slug ?? ''}
                placeholder="auto-generated from title if left blank"
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/10 px-4 text-sm text-text-primary outline-none transition focus:border-accent/35"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-text-primary">Excerpt</label>
              <textarea
                name="excerpt"
                rows={3}
                defaultValue={editingPost?.excerpt ?? ''}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent/35"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-text-primary">Content</label>
              <textarea
                name="content"
                required
                rows={12}
                defaultValue={editingPost?.content ?? ''}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent/35"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-text-primary">SEO title</label>
                <input
                  name="seoTitle"
                  defaultValue={editingPost?.seoTitle ?? ''}
                  className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/10 px-4 text-sm text-text-primary outline-none transition focus:border-accent/35"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-text-primary">SEO description</label>
                <input
                  name="seoDescription"
                  defaultValue={editingPost?.seoDescription ?? ''}
                  className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/10 px-4 text-sm text-text-primary outline-none transition focus:border-accent/35"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-text-primary">Status</label>
                <select
                  name="status"
                  defaultValue={editingPost?.status ?? 'draft'}
                  className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/10 px-4 text-sm text-text-primary outline-none transition focus:border-accent/35"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
              <label className="mt-8 inline-flex items-center gap-3 text-sm font-semibold text-text-primary">
                <input type="checkbox" name="featured" defaultChecked={editingPost?.featured ?? false} className="accent-accent" />
                Mark as featured
              </label>
            </div>
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-accent/25 bg-accent/15 px-5 text-sm font-semibold text-text-primary transition hover:border-accent/40"
            >
              {editingPost ? 'Save changes' : 'Create post'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
