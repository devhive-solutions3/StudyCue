import AdminAnnouncementsClient from '@/components/admin/AdminAnnouncementsClient';
import { requireAdminUser } from '@/lib/admin-auth';
import { readAdminDataSourceStatus } from '@/lib/admin-data';
import { listAnnouncementsAdmin } from '@/lib/announcements-server';

export default async function AdminAnnouncementsPage() {
  await requireAdminUser({ nextPath: '/admin/announcements', onUnauthorized: 'notFound' });
  const dataSource = readAdminDataSourceStatus();
  const announcements = await listAnnouncementsAdmin();

  return (
    <section className="space-y-6">
      <div className="rounded-[28px] border border-white/10 bg-white/5 px-6 py-5 backdrop-blur-xl">
        <h2 className="text-lg font-extrabold text-text-primary">Announcements</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Publish in-app announcements for Beta, Premium, or all users. Users see each announcement once.
        </p>
      </div>
      {!dataSource.configured ? (
        <div className="rounded-[24px] border border-amber-400/25 bg-amber-500/10 px-6 py-5 text-sm text-amber-100/90">
          {dataSource.message}
        </div>
      ) : null}
      <AdminAnnouncementsClient initialAnnouncements={announcements} />
    </section>
  );
}
