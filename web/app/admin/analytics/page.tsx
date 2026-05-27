import { requireAdminUser } from '@/lib/admin-auth';
import { readAdminDataSourceStatus } from '@/lib/admin-data';
import { formatCompactNumber, formatStorageBytes } from '@/lib/admin-shared';
import { readProductAnalyticsDashboard } from '@/lib/analytics-admin-data';

function percent(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}

export default async function AdminAnalyticsPage() {
  await requireAdminUser({ nextPath: '/admin/analytics', onUnauthorized: 'notFound' });

  const dataSource = readAdminDataSourceStatus();
  const dashboard = await readProductAnalyticsDashboard();

  return (
    <section className="space-y-6">
      <div className="rounded-[28px] border border-white/10 bg-white/5 px-6 py-5 backdrop-blur-xl dark:border-white/8 dark:bg-white/6">
        <h2 className="text-lg font-extrabold text-text-primary">Product analytics</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Privacy-safe aggregates only. No task titles, note content, Cue prompts, calendar details, or
          file names are stored in analytics events.
        </p>
      </div>

      {!dataSource.configured ? (
        <div className="rounded-[24px] border border-amber-400/25 bg-amber-500/10 px-6 py-5 text-sm text-amber-100/90">
          {dataSource.message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total users', value: formatCompactNumber(dashboard.summary.totalUsers) },
          { label: 'Signups today', value: formatCompactNumber(dashboard.summary.signupsToday) },
          { label: 'Active today', value: formatCompactNumber(dashboard.summary.activeUsersToday) },
          {
            label: 'Active this week',
            value: formatCompactNumber(dashboard.summary.activeUsersThisWeek),
          },
          { label: 'Cue messages today', value: formatCompactNumber(dashboard.summary.cueMessagesToday) },
          {
            label: 'Notes uploaded today',
            value: formatCompactNumber(dashboard.summary.notesUploadedToday),
          },
          {
            label: 'Bug reports open',
            value: formatCompactNumber(dashboard.summary.bugReportsOpen),
          },
          {
            label: 'Bug reports today',
            value: formatCompactNumber(dashboard.summary.bugReportsSubmittedToday),
          },
          {
            label: 'Total storage used',
            value: formatStorageBytes(dashboard.summary.totalStorageUsedBytes),
          },
        ].map((card) => (
          <article
            key={card.label}
            className="rounded-[24px] border border-white/10 bg-white/5 p-5 dark:border-white/8 dark:bg-white/6"
          >
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-muted">{card.label}</p>
            <p className="mt-3 text-3xl font-black text-text-primary">{card.value}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-[24px] border border-white/10 bg-white/5 p-5 dark:border-white/8 dark:bg-white/6">
          <h3 className="text-sm font-extrabold uppercase tracking-[0.2em] text-text-muted">Retention</h3>
          <p className="mt-2 text-sm text-text-secondary">
            Cohort signup date: {dashboard.retention.cohortDateKey} · {dashboard.retention.cohortSize}{' '}
            users
          </p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-text-muted">D1 return</dt>
              <dd className="text-2xl font-black text-text-primary">
                {percent(dashboard.retention.d1Rate)}
              </dd>
              <dd className="text-xs text-text-secondary">
                {dashboard.retention.d1Returned} / {dashboard.retention.cohortSize}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">D7 return</dt>
              <dd className="text-2xl font-black text-text-primary">
                {percent(dashboard.retention.d7Rate)}
              </dd>
              <dd className="text-xs text-text-secondary">
                {dashboard.retention.d7Returned} / {dashboard.retention.cohortSize}
              </dd>
            </div>
          </dl>
        </article>

        <article className="rounded-[24px] border border-white/10 bg-white/5 p-5 dark:border-white/8 dark:bg-white/6">
          <h3 className="text-sm font-extrabold uppercase tracking-[0.2em] text-text-muted">
            Active users by plan (today)
          </h3>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex justify-between">
              <span className="text-text-secondary">Free</span>
              <span className="font-semibold text-text-primary">
                {formatCompactNumber(dashboard.planBreakdownToday.free)}
              </span>
            </li>
            <li className="flex justify-between">
              <span className="text-text-secondary">Beta</span>
              <span className="font-semibold text-text-primary">
                {formatCompactNumber(dashboard.planBreakdownToday.beta)}
              </span>
            </li>
            <li className="flex justify-between">
              <span className="text-text-secondary">Premium</span>
              <span className="font-semibold text-text-primary">
                {formatCompactNumber(dashboard.planBreakdownToday.premium)}
              </span>
            </li>
          </ul>
        </article>
      </div>

      <article className="rounded-[24px] border border-white/10 bg-white/5 p-5 dark:border-white/8 dark:bg-white/6">
        <h3 className="text-sm font-extrabold uppercase tracking-[0.2em] text-text-muted">
          Feature usage
        </h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-text-muted">
                <th className="px-3 py-2">Feature</th>
                <th className="px-3 py-2">Events today</th>
                <th className="px-3 py-2">Events (7d)</th>
                <th className="px-3 py-2">Unique users (7d)</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.featureUsage.map((row) => (
                <tr key={row.feature} className="border-b border-white/5">
                  <td className="px-3 py-2 font-semibold text-text-primary">{row.label}</td>
                  <td className="px-3 py-2 text-text-secondary">{row.eventsToday}</td>
                  <td className="px-3 py-2 text-text-secondary">{row.eventsLast7Days}</td>
                  <td className="px-3 py-2 text-text-secondary">{row.uniqueUsersLast7Days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="rounded-[24px] border border-white/10 bg-white/5 p-5 dark:border-white/8 dark:bg-white/6">
        <h3 className="text-sm font-extrabold uppercase tracking-[0.2em] text-text-muted">
          Recent safe events
        </h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-text-muted">
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Feature</th>
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Route</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.recentEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-text-muted">
                    No analytics events yet.
                  </td>
                </tr>
              ) : (
                dashboard.recentEvents.map((row) => (
                  <tr key={row.id} className="border-b border-white/5">
                    <td className="px-3 py-2 text-text-secondary">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-text-secondary">{row.eventType}</td>
                    <td className="px-3 py-2 text-text-secondary">{row.feature}</td>
                    <td className="px-3 py-2 text-text-secondary">{row.userPlan}</td>
                    <td className="px-3 py-2 text-text-secondary">{row.emailMasked}</td>
                    <td className="px-3 py-2 text-text-secondary">{row.route ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
