import { readAdminDataSourceStatus, readSecurityDashboard } from '@/lib/admin-data';
import { formatAdminDate } from '@/lib/admin-shared';

function SecurityCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <article className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[0_16px_48px_rgba(9,12,35,0.18)] backdrop-blur-xl dark:border-white/8 dark:bg-white/6">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-text-muted">{label}</p>
      <p className="mt-4 text-3xl font-black tracking-tight text-text-primary">{value}</p>
    </article>
  );
}

export default async function AdminSecurityPage() {
  const dataSource = readAdminDataSourceStatus();
  const dashboard = await readSecurityDashboard();

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-white/10 bg-white/5 px-6 py-5 backdrop-blur-xl dark:border-white/8 dark:bg-white/6">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">Admin / Security</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-text-primary">Security and audit logs</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Failed admin access attempts, rate limit hits, API errors, and audit events in one protected feed.
        </p>
      </div>

      {!dataSource.configured ? (
        <div className="rounded-[24px] border border-amber-400/25 bg-amber-500/10 px-6 py-5 text-sm text-amber-100/90">
          Firebase Admin credentials are not configured. Security feeds stay empty until admin credentials are available on the server.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SecurityCard label="Failed admin attempts" value={dashboard.todayCounts.failedAdminAttempts} />
        <SecurityCard label="Rate limit hits" value={dashboard.todayCounts.rateLimitHits} />
        <SecurityCard label="API errors" value={dashboard.todayCounts.apiErrors} />
        <SecurityCard label="Permission errors" value={dashboard.todayCounts.permissionErrors} />
        <SecurityCard label="Critical events" value={dashboard.todayCounts.criticalEvents} />
      </div>

      <section className="overflow-hidden rounded-[26px] border border-white/10 bg-white/5 shadow-[0_18px_48px_rgba(9,12,35,0.16)] backdrop-blur-xl dark:border-white/8 dark:bg-white/6">
        <div className="border-b border-white/8 px-5 py-4">
          <h2 className="text-base font-bold text-text-primary">Security feed</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-black/10 text-xs uppercase tracking-[0.2em] text-text-muted">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.events.map((event) => (
                <tr key={event.id} className="border-t border-white/8 text-text-secondary">
                  <td className="px-4 py-4 align-top">{formatAdminDate(event.time)}</td>
                  <td className="px-4 py-4 align-top">
                    <span className="inline-flex rounded-full border border-white/10 bg-black/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-text-primary">
                      {event.severity}
                    </span>
                  </td>
                  <td className="px-4 py-4 align-top">{event.actor}</td>
                  <td className="px-4 py-4 align-top text-text-primary">{event.action}</td>
                  <td className="px-4 py-4 align-top">{event.target}</td>
                  <td className="px-4 py-4 align-top">{event.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
