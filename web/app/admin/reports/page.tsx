import AdminBugReportsClient from '@/components/admin/AdminBugReportsClient';
import { readAdminDataSourceStatus } from '@/lib/admin-data';
import { listBugReportsForAdmin, readBugReportOverviewCounts } from '@/lib/bug-report-server';

export default async function AdminReportsPage() {
  const dataSource = readAdminDataSourceStatus();
  const [reports, counts] = await Promise.all([
    listBugReportsForAdmin().catch(() => []),
    readBugReportOverviewCounts().catch(() => ({
      open: 0,
      reviewing: 0,
      fixed: 0,
      closed: 0,
      highPriority: 0,
      openReports: 0,
      reportsToday: 0,
    })),
  ]);

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-white/10 bg-white/5 px-6 py-5 backdrop-blur-xl dark:border-white/8 dark:bg-white/6">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">Admin / Reports</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-text-primary">Bug reports</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Review beta feedback, screenshots, and triage status without touching notes or schedule import
          storage.
        </p>
      </div>

      {!dataSource.configured ? (
        <div className="rounded-[24px] border border-amber-400/25 bg-amber-500/10 px-6 py-5 text-sm text-amber-100/90">
          Firebase Admin credentials are not configured. Bug reports will stay empty until admin credentials are available.
        </div>
      ) : null}

      <AdminBugReportsClient reports={reports} counts={counts} />
    </div>
  );
}
