import AdminUsageCharts from '@/components/admin/AdminUsageCharts';
import { readAiUsageDashboard, readAdminDataSourceStatus } from '@/lib/admin-data';
import { adminMoney, formatAdminDate, formatTokens } from '@/lib/admin-shared';

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[0_16px_48px_rgba(9,12,35,0.18)] backdrop-blur-xl dark:border-white/8 dark:bg-white/6">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-text-muted">{label}</p>
      <p className="mt-4 text-3xl font-black tracking-tight text-text-primary">{value}</p>
    </article>
  );
}

export default async function AdminAiUsagePage() {
  const dataSource = readAdminDataSourceStatus();
  const dashboard = await readAiUsageDashboard();
  const hasLogs = dashboard.recentLogs.length > 0 || dashboard.daily.some((row) => row.requests > 0);

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-white/10 bg-white/5 px-6 py-5 backdrop-blur-xl dark:border-white/8 dark:bg-white/6">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">Admin / AI Usage</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-text-primary">Cue AI usage</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Safe telemetry only: request counts, token estimates, provider routing, rate limits, and estimated cost.
        </p>
      </div>

      {!dataSource.configured ? (
        <div className="rounded-[24px] border border-amber-400/25 bg-amber-500/10 px-6 py-5 text-sm text-amber-100/90">
          Firebase Admin credentials are not configured. AI usage metrics will appear here after the server can access Firestore with admin credentials.
        </div>
      ) : null}

      {!hasLogs ? (
        <div className="rounded-[24px] border border-dashed border-white/14 bg-white/4 px-6 py-12 text-center">
          <p className="text-base font-semibold text-text-primary">No Cue AI usage has been logged yet.</p>
          <p className="mt-2 text-sm text-text-secondary">
            Usage will appear after users send Cue AI messages.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Requests today" value={formatTokens(dashboard.today.requests)} />
            <MetricCard label="Requests this month" value={formatTokens(dashboard.month.requests)} />
            <MetricCard label="Tokens today" value={formatTokens(dashboard.today.tokens)} />
            <MetricCard label="Tokens this month" value={formatTokens(dashboard.month.tokens)} />
            <MetricCard label="Estimated cost today" value={adminMoney(dashboard.today.costPhp)} />
            <MetricCard label="Estimated cost this month" value={adminMoney(dashboard.month.costPhp)} />
            <MetricCard label="Errors" value={formatTokens(dashboard.today.errors)} />
            <MetricCard label="Rate limit hits" value={formatTokens(dashboard.today.rateLimitHits)} />
          </div>

          <AdminUsageCharts daily={dashboard.daily} providerSplit={dashboard.providerSplit} />

          <section className="overflow-hidden rounded-[26px] border border-white/10 bg-white/5 shadow-[0_18px_48px_rgba(9,12,35,0.16)] backdrop-blur-xl dark:border-white/8 dark:bg-white/6">
            <div className="border-b border-white/8 px-5 py-4">
              <h2 className="text-base font-bold text-text-primary">Recent AI requests</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-black/10 text-xs uppercase tracking-[0.2em] text-text-muted">
                  <tr>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">UID</th>
                    <th className="px-4 py-3">Provider</th>
                    <th className="px-4 py-3">Model</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Tokens</th>
                    <th className="px-4 py-3">Cost</th>
                    <th className="px-4 py-3">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.recentLogs.map((log) => (
                    <tr key={log.id} className="border-t border-white/8 text-text-secondary">
                      <td className="px-4 py-4 align-top">{formatAdminDate(log.createdAt)}</td>
                      <td className="px-4 py-4 align-top">
                        <span className="break-all text-xs text-text-primary">{log.uid}</span>
                      </td>
                      <td className="px-4 py-4 align-top">{log.provider}</td>
                      <td className="px-4 py-4 align-top">{log.model}</td>
                      <td className="px-4 py-4 align-top">{log.status}</td>
                      <td className="px-4 py-4 align-top">{formatTokens(log.totalTokensEstimate)}</td>
                      <td className="px-4 py-4 align-top">{adminMoney(log.estimatedCostPhp)}</td>
                      <td className="px-4 py-4 align-top">{log.errorCode ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
