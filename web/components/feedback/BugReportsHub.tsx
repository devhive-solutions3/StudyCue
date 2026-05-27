'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  bugReportScreenshotRejectReason,
  uploadBugReportScreenshot,
} from '@/lib/bug-report-storage';
import {
  canUserFollowUp,
  type UserBugReportView,
} from '@/lib/bug-report-types';
import { useWebAuth } from '@/lib/firebase-client';

function collectBrowserInfo(): string {
  if (typeof navigator === 'undefined') return '';
  return navigator.userAgent;
}

function collectDeviceInfo(): string {
  if (typeof navigator === 'undefined') return '';
  const parts = [
    navigator.platform,
    navigator.language,
    typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : null,
  ].filter(Boolean);
  return parts.join(' · ');
}

function formatWhen(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString();
}

function statusLabel(report: UserBugReportView): string {
  if (report.isSolved) return 'Solved';
  if (report.status === 'reviewing') return 'In review';
  return 'Open';
}

function statusTone(report: UserBugReportView): string {
  if (report.isSolved) {
    return 'border-emerald-700/50 bg-emerald-100 text-emerald-950 dark:border-emerald-400/60 dark:bg-emerald-950/70 dark:text-emerald-50';
  }
  if (report.status === 'reviewing') {
    return 'border-amber-700/50 bg-amber-100 text-amber-950 dark:border-amber-400/60 dark:bg-amber-950/60 dark:text-amber-50';
  }
  return 'border-sky-700/50 bg-sky-100 text-sky-950 dark:border-sky-400/60 dark:bg-sky-950/70 dark:text-sky-50';
}

function statusDetail(report: UserBugReportView): string {
  switch (report.status) {
    case 'open':
      return 'Waiting for review';
    case 'reviewing':
      return 'Team is looking into it';
    case 'fixed':
      return 'Marked fixed';
    case 'closed':
      return 'Closed';
    default:
      return report.status;
  }
}

function NewReportForm({
  initialPageUrl,
  onCancel,
  onCreated,
}: {
  initialPageUrl: string;
  onCancel: () => void;
  onCreated: (reportId: string) => void;
}) {
  const { user } = useWebAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pageUrl, setPageUrl] = useState(initialPageUrl);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onScreenshotChange(file: File | null) {
    setScreenshotError(null);
    if (!file) {
      setScreenshotFile(null);
      return;
    }
    const rejectReason = bugReportScreenshotRejectReason(file);
    if (rejectReason) {
      setScreenshotFile(null);
      setScreenshotError(rejectReason);
      return;
    }
    setScreenshotFile(file);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    if (!trimmedTitle || !trimmedDescription) {
      setError('Title and description are required.');
      return;
    }
    if (screenshotError) {
      setError(screenshotError);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/bug-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          title: trimmedTitle,
          description: trimmedDescription,
          pageUrl: pageUrl.trim() || null,
          browserInfo: collectBrowserInfo(),
          deviceInfo: collectDeviceInfo(),
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        reportId?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }

      const reportId = payload?.reportId;
      if (!reportId) throw new Error('No report ID returned.');

      if (screenshotFile) {
        try {
          await uploadBugReportScreenshot({
            uid: user.uid,
            reportId,
            file: screenshotFile,
          });
        } catch (uploadError) {
          const uploadMessage =
            uploadError instanceof Error ? uploadError.message : 'Screenshot upload failed.';
          const proceedWithout = window.confirm(
            `${uploadMessage}\n\nSubmit without the screenshot?`,
          );
          if (!proceedWithout) throw uploadError;
        }
      }

      onCreated(reportId);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not submit bug report.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-bug-report-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[20px] border border-border bg-surface p-5 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="new-bug-report-title" className="text-lg font-semibold text-text-primary">
              Report a bug
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Beta feedback is reviewed first. Add a screenshot if it helps.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-border px-2.5 py-1 text-sm font-medium text-text-secondary hover:bg-surface-2"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-text-primary">Title</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              required
              className="w-full rounded-[10px] border border-border bg-surface-2 px-3 py-2 text-sm text-text-primary"
              placeholder="Short summary"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-text-primary">Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
              rows={5}
              maxLength={8000}
              className="w-full rounded-[10px] border border-border bg-surface-2 px-3 py-2 text-sm text-text-primary"
              placeholder="What happened? Steps to reproduce?"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-text-primary">Page URL (optional)</span>
            <input
              type="text"
              value={pageUrl}
              onChange={(event) => setPageUrl(event.target.value)}
              className="w-full rounded-[10px] border border-border bg-surface-2 px-3 py-2 text-sm text-text-primary"
              placeholder="/app/tasks"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-text-primary">Screenshot (optional)</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => onScreenshotChange(event.target.files?.[0] ?? null)}
              className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-[8px] file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
            />
            {screenshotFile ? (
              <p className="text-xs text-text-muted">{screenshotFile.name}</p>
            ) : null}
            {screenshotError ? <p className="text-xs text-rose-600">{screenshotError}</p> : null}
          </label>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex flex-1 justify-center rounded-[10px] bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent-hover disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-[10px] border border-border px-4 py-2 text-sm text-text-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReportCard({
  report,
  onFollowUp,
}: {
  report: UserBugReportView;
  onFollowUp: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [followUpText, setFollowUpText] = useState('');
  const [followUpPending, setFollowUpPending] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);

  const allowFollowUp = canUserFollowUp(report.status);

  async function submitFollowUp() {
    const message = followUpText.trim();
    if (!message) {
      setFollowUpError('Write a follow-up message first.');
      return;
    }

    setFollowUpPending(true);
    setFollowUpError(null);
    try {
      const response = await fetch(
        `/api/bug-reports/${encodeURIComponent(report.reportId)}/follow-up`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ message }),
        },
      );
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }
      setFollowUpText('');
      onFollowUp();
    } catch (caughtError) {
      setFollowUpError(
        caughtError instanceof Error ? caughtError.message : 'Could not send follow-up.',
      );
    } finally {
      setFollowUpPending(false);
    }
  }

  return (
    <article className="rounded-[14px] border border-border bg-surface p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] text-text-muted">{report.reportId}</p>
          <h3 className="mt-1 font-semibold text-text-primary">{report.title}</h3>
          <p className="mt-1 text-xs text-text-secondary">{formatWhen(report.createdAt)} · {statusDetail(report)}</p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${statusTone(report)}`}
        >
          {statusLabel(report)}
        </span>
      </button>

      {expanded ? (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <p className="whitespace-pre-wrap text-sm leading-6 text-text-secondary">
            {report.description}
          </p>
          {report.pageUrl ? (
            <p className="text-xs text-text-muted">
              Page: <span className="font-mono text-text-secondary">{report.pageUrl}</span>
            </p>
          ) : null}
          {report.screenshotUrl ? (
            <a
              href={report.screenshotUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex text-sm font-semibold text-accent underline decoration-accent/40 underline-offset-2"
            >
              View screenshot
            </a>
          ) : null}

          {report.followUps.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                Your follow-ups
              </p>
              {report.followUps.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text-secondary"
                >
                  <p className="text-[11px] text-text-muted">{formatWhen(entry.createdAt)}</p>
                  <p className="mt-1 whitespace-pre-wrap">{entry.message}</p>
                </div>
              ))}
            </div>
          ) : null}

          {report.resolution ? (
            <div className="rounded-[10px] border border-emerald-700/40 bg-emerald-50 px-3 py-3 dark:border-emerald-500/50 dark:bg-emerald-950/50">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-950 dark:text-emerald-100">
                Resolution
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-text-secondary">
                {report.resolution}
              </p>
            </div>
          ) : null}

          {allowFollowUp ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                Add follow-up
              </p>
              <textarea
                value={followUpText}
                onChange={(event) => setFollowUpText(event.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Still happening? Add more details…"
                className="w-full rounded-[10px] border border-border bg-surface-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
              />
              {followUpError ? <p className="text-xs text-rose-600">{followUpError}</p> : null}
              <button
                type="button"
                disabled={followUpPending}
                onClick={() => void submitFollowUp()}
                className="inline-flex rounded-[10px] bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent-hover disabled:opacity-60"
              >
                {followUpPending ? 'Sending…' : 'Send follow-up'}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export default function BugReportsHub({
  initialPageUrl = '',
  autoOpenForm = false,
}: {
  initialPageUrl?: string;
  autoOpenForm?: boolean;
}) {
  const { user, ready } = useWebAuth();
  const [reports, setReports] = useState<UserBugReportView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(autoOpenForm);
  const [flash, setFlash] = useState<string | null>(null);

  const reloadReports = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch('/api/bug-reports', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        reports?: UserBugReportView[];
      } | null;
      if (!response.ok) {
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }
      setReports(payload?.reports ?? []);
    } catch (caughtError) {
      setLoadError(caughtError instanceof Error ? caughtError.message : 'Could not load reports.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset list when signed out
      setReports([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    fetch('/api/bug-reports', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
          reports?: UserBugReportView[];
        } | null;
        if (!response.ok) {
          throw new Error(payload?.error || `HTTP ${response.status}`);
        }
        if (!cancelled) setReports(payload?.reports ?? []);
      })
      .catch((caughtError) => {
        if (!cancelled) {
          setLoadError(
            caughtError instanceof Error ? caughtError.message : 'Could not load reports.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ready, user]);

  const { openCount, solvedCount } = useMemo(() => {
    const open = reports.filter((report) => !report.isSolved).length;
    return { openCount: open, solvedCount: reports.length - open };
  }, [reports]);

  if (!ready) {
    return <div className="px-4 py-10 text-sm text-text-secondary">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl space-y-4 px-4 py-10">
        <h1 className="text-2xl font-semibold text-text-primary">Bug reports</h1>
        <p className="text-sm text-text-secondary">Sign in to report bugs and track your feedback.</p>
        <Link href="/login" className="inline-flex rounded-[10px] bg-accent px-4 py-2 text-sm font-semibold text-white">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-2xl space-y-6 px-4 py-8 pb-24">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.35em] text-text-muted">Beta feedback</p>
          <h1 className="mt-1 text-3xl font-semibold text-text-primary">Bug reports</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Track what you&apos;ve reported. Open items can get follow-ups until they&apos;re solved.
          </p>
          {reports.length > 0 ? (
            <p className="mt-2 text-xs text-text-muted">
              {openCount} open · {solvedCount} solved
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-white/90 bg-accent text-2xl font-semibold leading-none text-white shadow-[0_4px_16px_rgba(87,75,201,0.45)] ring-2 ring-accent/30 hover:bg-accent-hover"
          aria-label="Report a bug"
          title="Report a bug"
        >
          +
        </button>
      </div>

      {flash ? (
        <div className="rounded-[12px] border border-border bg-surface px-4 py-3 text-sm font-medium text-text-primary shadow-sm ring-1 ring-accent/20">
          {flash}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-text-secondary">Loading your reports…</p>
      ) : loadError ? (
        <p className="text-sm text-rose-600">{loadError}</p>
      ) : reports.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-border bg-surface-2 px-5 py-10 text-center">
          <p className="text-sm text-text-secondary">No bug reports yet.</p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="mt-4 inline-flex rounded-[10px] bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent-hover"
          >
            Report your first bug
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <ReportCard key={report.reportId} report={report} onFollowUp={() => void reloadReports()} />
          ))}
        </div>
      )}

      {showForm ? (
        <NewReportForm
          initialPageUrl={initialPageUrl}
          onCancel={() => setShowForm(false)}
          onCreated={(reportId) => {
            setShowForm(false);
            setFlash(`Bug report submitted. ID: ${reportId}`);
            void reloadReports();
          }}
        />
      ) : null}
    </div>
  );
}
