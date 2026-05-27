'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { formatAdminDate } from '@/lib/admin-shared';
import {
  BUG_REPORT_PRIORITIES,
  BUG_REPORT_STATUSES,
  type BugReportRecord,
} from '@/lib/bug-report-types';

export default function AdminBugReportDetailClient({ report }: { report: BugReportRecord }) {
  const router = useRouter();
  const [status, setStatus] = useState(report.status);
  const [priority, setPriority] = useState(report.priority);
  const [resolution, setResolution] = useState(report.adminNotes ?? '');
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveChanges() {
    setPending(true);
    setFeedback(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/bug-reports/${encodeURIComponent(report.reportId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          status,
          priority,
          adminNotes: resolution.trim() ? resolution.trim() : null,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }

      setFeedback('Bug report updated.');
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not update bug report.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/reports"
          className="inline-flex rounded-full border border-white/10 bg-black/10 px-3 py-1 text-xs font-semibold text-text-secondary"
        >
          ← All reports
        </Link>
        <p className="font-mono text-sm text-text-primary">{report.reportId}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <article className="space-y-4 rounded-[24px] border border-white/10 bg-white/5 p-5 backdrop-blur-xl dark:border-white/8 dark:bg-white/6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-text-muted">Title</p>
            <h2 className="mt-2 text-xl font-bold text-text-primary">{report.title}</h2>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-text-muted">Description</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-secondary">
              {report.description}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-text-muted">Page URL</p>
              <p className="mt-2 break-all text-sm text-text-secondary">{report.pageUrl || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-text-muted">Created</p>
              <p className="mt-2 text-sm text-text-secondary">{formatAdminDate(report.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-text-muted">Browser</p>
              <p className="mt-2 break-all text-sm text-text-secondary">{report.browserInfo || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-text-muted">Device</p>
              <p className="mt-2 break-all text-sm text-text-secondary">{report.deviceInfo || '—'}</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-text-muted">Screenshot</p>
            {report.screenshotUrl ? (
              <div className="mt-3 space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={report.screenshotUrl}
                  alt="Bug report screenshot"
                  className="max-h-80 w-full rounded-[12px] border border-white/10 object-contain bg-black/20"
                />
                <a
                  href={report.screenshotUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex text-sm font-semibold text-accent"
                >
                  Open screenshot in new tab
                </a>
                {report.screenshotOriginalName ? (
                  <p className="text-xs text-text-muted">{report.screenshotOriginalName}</p>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-sm text-text-secondary">
                No screenshot attached
                {report.screenshotStoragePath ? ' (upload may have failed before the fix).' : '.'}
              </p>
            )}
          </div>

          {report.followUps.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-text-muted">User follow-ups</p>
              <div className="mt-3 space-y-2">
                {report.followUps.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-[12px] border border-white/10 bg-black/10 px-3 py-2 text-sm text-text-secondary"
                  >
                    <p className="text-[11px] text-text-muted">{formatAdminDate(entry.createdAt)}</p>
                    <p className="mt-1 whitespace-pre-wrap">{entry.message}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </article>

        <aside className="space-y-4 rounded-[24px] border border-white/10 bg-white/5 p-5 backdrop-blur-xl dark:border-white/8 dark:bg-white/6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-text-muted">Reporter</p>
            <p className="mt-2 text-sm font-semibold text-text-primary">
              {report.userDisplayName || '—'}
            </p>
            <p className="text-sm text-text-secondary">{report.userEmail || report.uid}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-text-muted">
              Plan: {report.userPlan}
            </p>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
              className="w-full rounded-[12px] border border-white/10 bg-black/20 px-3 py-2 text-sm text-text-primary"
            >
              {BUG_REPORT_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Priority</span>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as typeof priority)}
              className="w-full rounded-[12px] border border-white/10 bg-black/20 px-3 py-2 text-sm text-text-primary"
            >
              {BUG_REPORT_PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-[16px] border border-white/10 bg-black/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Resolution</p>
            <p className="mt-1 text-xs text-text-secondary">
              What was the issue and how it was fixed. Shown to the user when status is Fixed or Closed.
            </p>
            <textarea
              value={resolution}
              onChange={(event) => setResolution(event.target.value)}
              rows={5}
              className="mt-3 w-full rounded-[12px] border border-white/10 bg-black/20 px-3 py-2 text-sm text-text-primary"
              placeholder="e.g. Notes upload failed on Safari because… Fixed by updating storage rules."
            />
          </div>

          {feedback ? <p className="text-sm text-emerald-300">{feedback}</p> : null}
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <button
            type="button"
            disabled={pending}
            onClick={() => void saveChanges()}
            className="inline-flex w-full justify-center rounded-[12px] bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? 'Saving…' : 'Save triage & resolution'}
          </button>

          {report.resolvedAt ? (
            <p className="text-xs text-text-muted">
              Resolved {formatAdminDate(report.resolvedAt)}
              {report.resolvedByEmail ? ` by ${report.resolvedByEmail}` : ''}
            </p>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
