import type { Metadata } from 'next';
import Link from 'next/link';

import AdminNav from '@/components/admin/AdminNav';
import { adminSections } from '@/lib/admin-data';
import { requireAdminUser } from '@/lib/admin-auth';

export const metadata: Metadata = {
  title: 'Admin dashboard',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const adminUser = await requireAdminUser({ nextPath: '/admin', onUnauthorized: 'notFound' });
  const navItems = adminSections().map((section) => ({ title: section.title, href: section.href }));

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 sm:px-8">
        <header className="flex flex-col gap-4 rounded-[28px] border border-white/10 bg-white/5 px-6 py-5 shadow-[0_20px_80px_rgba(8,10,30,0.28)] backdrop-blur-xl dark:border-white/8 dark:bg-white/6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-text-muted">
              StudyCue Admin
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-text-primary">
              Protected admin dashboard
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
              Signed in as {adminUser.email ?? adminUser.uid}. This route is guarded server-side.
            </p>
          </div>
          <Link
            href="/app"
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/12 bg-white/10 px-4 text-sm font-semibold text-text-primary transition hover:bg-white/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(151,113,255,0.45)] dark:border-white/10 dark:bg-white/8"
          >
            Back to app
          </Link>
        </header>

        <div className="mt-6">
          <AdminNav items={navItems} />
        </div>

        <main className="mt-6 flex-1">{children}</main>
      </div>
    </div>
  );
}
