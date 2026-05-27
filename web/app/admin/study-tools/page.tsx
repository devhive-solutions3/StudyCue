import AdminStudyToolsClient from '@/components/admin/AdminStudyToolsClient';
import { requireAdminUser } from '@/lib/admin-auth';
import { readAdminDataSourceStatus } from '@/lib/admin-data';
import { readStudyToolsAdminDashboard } from '@/lib/admin-study-tools-data';

export default async function AdminStudyToolsPage() {
  await requireAdminUser({ nextPath: '/admin/study-tools', onUnauthorized: 'notFound' });
  const dataSource = readAdminDataSourceStatus();
  const dashboard = await readStudyToolsAdminDashboard();

  return (
    <section className="space-y-6">
      <div className="rounded-[28px] border border-white/10 bg-white/5 px-6 py-5 backdrop-blur-xl">
        <h2 className="text-lg font-extrabold text-text-primary">Study Tools analytics</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Generation counts, plan limits, and source surfaces only. No quiz text, flashcard content, prompts, or
          uploaded file text is stored here.
        </p>
      </div>
      {!dataSource.configured ? (
        <div className="rounded-[24px] border border-amber-400/25 bg-amber-500/10 px-6 py-5 text-sm text-amber-100/90">
          {dataSource.message}
        </div>
      ) : null}
      <AdminStudyToolsClient dashboard={dashboard} />
    </section>
  );
}
