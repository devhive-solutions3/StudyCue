'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { formatAdminDate } from '@/lib/admin-shared';
import type { BugReportListRow, BugReportOverviewCounts } from '@/lib/bug-report-types';

type StatusFilter = 'all' | 'open' | 'reviewing' | 'fixed' | 'closed';
type PlanFilter = 'all' | 'free' | 'beta' | 'premium';

const STATUS_FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: 'All statuses' },
  { key: 'open', label: 'Open' },
  { key: 'reviewing', label: 'Reviewing' },
  { key: 'fixed', label: 'Fixed' },
  { key: 'closed', label: 'Closed' },
];

const PLAN_FILTERS: Array<{ key: PlanFilter; label: string }> = [
  { key: 'all', label: 'All plans' },
  { key: 'beta', label: 'Beta' },
  { key: 'free', label: 'Free' },
  { key: 'premium', label: 'Premium' },
];

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'open':
      return 'border-sky-400/30 bg-sky-500/15 text-sky-200';
    case 'reviewing':
      return 'border-amber-400/30 bg-amber-500/15 text-amber-100';
    case 'fixed':
      return 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100';
    case 'closed':
      return 'border-white/15 bg-white/10 text-text-secondary';
    default:
      return 'border-white/10 bg-black/10 text-text-secondary';
  }
}

function priorityBadgeClass(priority: string): string {
  switch (priority) {
    case 'critical':
      return 'border-rose-300/80 bg-rose-600/50 text-white shadow-sm';
    case 'high':
      return 'border-orange-300/80 bg-orange-600/45 text-white shadow-sm';
    case 'medium':
      return 'border-amber-200/90 bg-amber-600/55 text-white shadow-sm';
    case 'low':
      return 'border-sky-300/70 bg-sky-600/40 text-sky-50 shadow-sm';
    default:
      return 'border-white/35 bg-white/20 text-text-primary shadow-sm';
  }
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[0_16px_48px_rgba(9,12,35,0.18)] backdrop-blur-xl dark:border-white/8 dark:bg-white/6">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-text-muted">{label}</p>
      <p className="mt-4 text-3xl font-black tracking-tight text-text-primary">{value}</p>
    </article>
  );
}

export default function AdminBugReportsClient({
  reports,
  counts,
}: {
  reports: BugReportListRow[];
  counts: BugReportOverviewCounts;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [planFilter, setPlanFilter] = useState<PlanFilter>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return reports.filter((report) => {
      if (statusFilter !== 'all' && report.status !== statusFilter) return false;
      if (planFilter !== 'all' && report.userPlan !== planFilter) return false;
      if (!normalizedQuery) return true;
      return [
        report.reportId,
        report.userEmail ?? '',
        report.userDisplayName ?? '',
        report.title,
        report.uid,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [planFilter, query, reports, statusFilter]);

  return (
    <section className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Open" value={counts.open} />
        <SummaryCard label="Reviewing" value={counts.reviewing} />
        <SummaryCard label="Fixed" value={counts.fixed} />
        <SummaryCard label="Closed" value={counts.closed} />
        <SummaryCard label="High / critical" value={counts.highPriority} />
      </div>

      <div className="flex flex-col gap-3 rounded-[24px] border border-white/10 bg-white/5 p-4 backdrop-blur-xl dark:border-white/8 dark:bg-white/6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
            Search
          </label>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Report ID, email, title…"
            className="w-full min-w-[240px] rounded-[12px] border border-white/10 bg-black/20 px-3 py-2 text-sm text-text-primary md:w-80"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setStatusFilter(filter.key)}
              className={[
                'rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em]',
                statusFilter === filter.key
                  ? 'border-accent/40 bg-accent/15 text-accent'
                  : 'border-white/10 bg-black/10 text-text-secondary',
              ].join(' ')}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {PLAN_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setPlanFilter(filter.key)}
              className={[
                'rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em]',
                planFilter === filter.key
                  ? 'border-accent/40 bg-accent/15 text-accent'
                  : 'border-white/10 bg-black/10 text-text-secondary',
              ].join(' ')}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <section className="overflow-hidden rounded-[26px] border border-white/10 bg-white/5 shadow-[0_18px_48px_rgba(9,12,35,0.16)] backdrop-blur-xl dark:border-white/8 dark:bg-white/6">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-black/10 text-xs uppercase tracking-[0.2em] text-text-muted">
              <tr>
                <th className="px-4 py-3">Report ID</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Page</th>
                <th className="px-4 py-3">Shot</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((report) => (
                <tr key={report.reportId} className="border-t border-white/8 text-text-secondary">
                  <td className="px-4 py-4 align-top font-mono text-xs text-text-primary">
                    {report.reportId}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <p className="text-text-primary">{report.userDisplayName || '—'}</p>
                    <p className="text-xs">{report.userEmail || report.uid}</p>
                  </td>
                  <td className="px-4 py-4 align-top capitalize">{report.userPlan}</td>
                  <td className="px-4 py-4 align-top text-text-primary">{report.title}</td>
                  <td className="px-4 py-4 align-top max-w-[160px] truncate">
                    {report.pageUrl || '—'}
                  </td>
                  <td className="px-4 py-4 align-top">{report.screenshotUrl ? 'Yes' : '—'}</td>
                  <td className="px-4 py-4 align-top">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${statusBadgeClass(report.status)}`}
                    >
                      {report.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${priorityBadgeClass(report.priority)}`}
                    >
                      {report.priority}
                    </span>
                  </td>
                  <td className="px-4 py-4 align-top">{formatAdminDate(report.createdAt)}</td>
                  <td className="px-4 py-4 align-top">
                    <Link
                      href={`/admin/reports/${encodeURIComponent(report.reportId)}`}
                      className="inline-flex rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-text-muted">
                    No bug reports match the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
