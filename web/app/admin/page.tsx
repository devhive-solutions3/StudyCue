import Link from 'next/link';

import AdminBetaSignupToggle from '@/components/admin/AdminBetaSignupToggle';
import { adminSections, readAdminDataSourceStatus, readAdminOverviewStats } from '@/lib/admin-data';
import { getBetaSignupsMode } from '@/lib/beta-config-server';
import { adminMoney, formatCompactNumber, formatStorageBytes } from '@/lib/admin-shared';
import { USER_PLAN_CONFIG } from '@/lib/user-plan';

const overviewCards = [
  { key: 'totalUsers', label: 'Users', tone: 'bg-accent/12 text-accent' },
  { key: 'betaUsers', label: 'Beta users', tone: 'bg-blue-100 text-blue-600' },
  { key: 'freeUsers', label: 'Free users', tone: 'bg-teal-100 text-teal-600' },
  { key: 'premiumUsers', label: 'Premium users', tone: 'bg-purple-100 text-purple-600' },
  { key: 'aiRequestsToday', label: 'AI requests today', tone: 'bg-blue-100 text-blue-600' },
  { key: 'publishedPosts', label: 'Published posts', tone: 'bg-teal-100 text-teal-600' },
  { key: 'netThisMonthPhp', label: 'Net this month', tone: 'bg-purple-100 text-purple-600' },
  { key: 'securityEventsToday', label: 'Security events today', tone: 'bg-amber-100 text-amber-600' },
  { key: 'openBugReports', label: 'Open bug reports', tone: 'bg-rose-100 text-rose-600', href: '/admin/reports' },
  { key: 'bugReportsToday', label: 'Bug reports today', tone: 'bg-orange-100 text-orange-600', href: '/admin/reports' },
  { key: 'activeUsersToday', label: 'Active users today', tone: 'bg-teal-100 text-teal-600', href: '/admin/analytics' },
  { key: 'activeUsersThisWeek', label: 'Active this week', tone: 'bg-blue-100 text-blue-600', href: '/admin/analytics' },
  { key: 'signupsToday', label: 'Signups today', tone: 'bg-purple-100 text-purple-600', href: '/admin/analytics' },
  { key: 'd1RetentionRate', label: 'D1 retention', tone: 'bg-amber-100 text-amber-600', href: '/admin/analytics' },
  { key: 'd7RetentionRate', label: 'D7 retention', tone: 'bg-amber-100 text-amber-600', href: '/admin/analytics' },
] as const;

export default async function AdminDashboardPage() {
  const dataSource = readAdminDataSourceStatus();
  const stats = await readAdminOverviewStats();
  const betaSignupMode = await getBetaSignupsMode();
  return (
    <section className="space-y-6">
      <div className="rounded-[28px] border border-white/10 bg-white/5 px-6 py-5 backdrop-blur-xl dark:border-white/8 dark:bg-white/6">
        <h2 className="text-lg font-extrabold text-text-primary">Admin overview</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Protected overview metrics plus direct links into each admin surface. All linked pages remain
          guarded server-side and still resolve to `404` for non-admin traffic.
        </p>
      </div>

      {!dataSource.configured ? (
        <div className="rounded-[24px] border border-amber-400/25 bg-amber-500/10 px-6 py-5">
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-amber-300">
            Admin data source not configured
          </p>
          <p className="mt-3 text-sm text-amber-100/90">
            {dataSource.message}
          </p>
          <p className="mt-2 text-sm text-amber-100/75">
            Add `FIREBASE_SERVICE_ACCOUNT_KEY` or `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`, then restart the dev server.
          </p>
        </div>
      ) : null}

      {stats.usersWarning ? (
        <div className="rounded-[24px] border border-amber-400/25 bg-amber-500/10 px-6 py-5">
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-amber-300">
            Firebase Auth users warning
          </p>
          <p className="mt-3 text-sm text-amber-100/90">{stats.usersWarning}</p>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map((card) => {
          const value =
            card.key === 'netThisMonthPhp'
              ? adminMoney(stats[card.key])
              : card.key === 'd1RetentionRate' || card.key === 'd7RetentionRate'
                ? `${Math.round((stats[card.key] ?? 0) * 1000) / 10}%`
                : formatCompactNumber(stats[card.key] ?? 0);
          const inner = (
            <>
              <div className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] ${card.tone}`}>
                {card.label}
              </div>
              <p className="mt-4 text-3xl font-black tracking-tight text-text-primary">{value}</p>
            </>
          );
          return (
            <article
              key={card.key}
              className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[0_16px_48px_rgba(9,12,35,0.18)] backdrop-blur-xl dark:border-white/8 dark:bg-white/6"
            >
              {'href' in card && card.href ? (
                <Link href={card.href} className="block transition hover:opacity-90">
                  {inner}
                </Link>
              ) : (
                inner
              )}
            </article>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <AdminBetaSignupToggle
          initialEnabled={betaSignupMode.enabled}
          source={betaSignupMode.source}
        />
        <article className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[0_16px_48px_rgba(9,12,35,0.18)] backdrop-blur-xl dark:border-white/8 dark:bg-white/6">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-text-muted">Free storage</p>
          <p className="mt-4 text-2xl font-black tracking-tight text-text-primary">
            {formatStorageBytes(USER_PLAN_CONFIG.free.storageLimitBytes)}
          </p>
        </article>
        <article className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[0_16px_48px_rgba(9,12,35,0.18)] backdrop-blur-xl dark:border-white/8 dark:bg-white/6">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-text-muted">Beta storage</p>
          <p className="mt-4 text-2xl font-black tracking-tight text-text-primary">
            {formatStorageBytes(USER_PLAN_CONFIG.beta.storageLimitBytes)}
          </p>
        </article>
        <article className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[0_16px_48px_rgba(9,12,35,0.18)] backdrop-blur-xl dark:border-white/8 dark:bg-white/6">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-text-muted">Premium storage</p>
          <p className="mt-4 text-2xl font-black tracking-tight text-text-primary">
            {formatStorageBytes(USER_PLAN_CONFIG.premium.storageLimitBytes)}
          </p>
        </article>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {adminSections().map((section) => (
          <Link
            key={section.title}
            href={section.href}
            className="group rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[0_16px_48px_rgba(9,12,35,0.18)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-accent/30 hover:bg-white/7 hover:shadow-[0_24px_56px_rgba(106,95,219,0.2)] dark:border-white/8 dark:bg-white/6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-text-muted">
                  {section.metric}
                </p>
                <h3 className="mt-3 text-base font-bold text-text-primary">{section.title}</h3>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-accent/20 bg-accent/10 text-accent transition group-hover:translate-x-0.5">
                →
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{section.description}</p>
            <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent">
              <span>Open</span>
              <span className="transition group-hover:translate-x-0.5">→</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
