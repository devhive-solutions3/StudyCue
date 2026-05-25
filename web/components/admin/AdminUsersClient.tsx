'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { formatAdminDate, formatStorageBytes, type AdminUserRow } from '@/lib/admin-shared';

type FilterKey = 'all' | 'beta' | 'free' | 'premium';

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'beta', label: 'Beta' },
  { key: 'free', label: 'Free' },
  { key: 'premium', label: 'Premium' },
];

export default function AdminUsersClient({ users }: { users: AdminUserRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [planDrafts, setPlanDrafts] = useState<Record<string, string>>({});
  const [pendingUid, setPendingUid] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return users.filter((user) => {
      if (filter === 'beta' && !user.betaTester) return false;
      if (filter === 'free' && user.accountType.toLowerCase() !== 'free') return false;
      if (filter === 'premium' && user.accountType.toLowerCase() !== 'premium') return false;

      if (!normalizedQuery) return true;
      return [user.uid, user.email ?? '', user.displayName ?? '']
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [filter, query, users]);

  function formatStorageUsage(user: AdminUserRow) {
    const used = user.storageUsedBytes ?? 0;
    const limit = user.storageLimitBytes ?? 0;
    const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
    return {
      label: `${formatStorageBytes(used)} / ${formatStorageBytes(limit)}`,
      percent,
    };
  }

  async function updatePlan(user: AdminUserRow) {
    const nextPlan = String(planDrafts[user.uid] ?? user.plan ?? 'free');
    if (!['free', 'beta', 'premium'].includes(nextPlan)) return;

    if (
      nextPlan === 'free' &&
      (user.accountType.toLowerCase() === 'beta' || user.accountType.toLowerCase() === 'premium') &&
      !window.confirm(`Change ${user.email ?? user.uid} to Free? This will remove beta/premium access.`)
    ) {
      return;
    }

    setPendingUid(user.uid);
    setFeedback(null);
    setError(null);
    try {
      const response = await fetch('/api/admin/users/update-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ uid: user.uid, plan: nextPlan }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }

      setFeedback(`User updated to ${nextPlan[0].toUpperCase()}${nextPlan.slice(1)}.`);
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not update user plan.');
    } finally {
      setPendingUid(null);
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 rounded-[24px] border border-white/10 bg-white/5 p-5 backdrop-blur-xl dark:border-white/8 dark:bg-white/6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-text-primary">Users</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Firebase Auth directory with merged `users/{'{uid}'}` profile data and admin plan controls.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by email, display name, or UID"
            className="h-11 min-w-[260px] rounded-2xl border border-white/10 bg-black/10 px-4 text-sm text-text-primary outline-none transition focus:border-accent/35"
          />
          <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 sm:overflow-visible">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={[
                  'shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition',
                  filter === item.key
                    ? 'border-accent/40 bg-accent/16 text-text-primary'
                    : 'border-white/10 bg-black/5 text-text-secondary hover:border-accent/25 hover:text-text-primary',
                ].join(' ')}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="shrink-0 rounded-full border border-white/10 bg-black/5 px-4 py-2 text-sm font-semibold text-text-secondary transition hover:border-accent/25 hover:text-text-primary"
          >
            Refresh
          </button>
        </div>
      </div>

      {feedback ? (
        <div className="rounded-[20px] border border-teal-400/25 bg-teal-500/10 px-5 py-3 text-sm text-teal-200">
          {feedback}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-[20px] border border-rose-400/25 bg-rose-500/10 px-5 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-white/14 bg-white/4 px-6 py-12 text-center">
          <p className="text-base font-semibold text-text-primary">No users found yet.</p>
          <p className="mt-2 text-sm text-text-secondary">
            Try a wider filter or wait until new StudyCue accounts are created.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[26px] border border-white/10 bg-white/5 shadow-[0_18px_48px_rgba(9,12,35,0.16)] backdrop-blur-xl dark:border-white/8 dark:bg-white/6">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-black/10 text-xs uppercase tracking-[0.2em] text-text-muted">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Limits</th>
                  <th className="px-4 py-3">Usage</th>
                  <th className="px-4 py-3">Beta</th>
                  <th className="px-4 py-3">Premium</th>
                  <th className="px-4 py-3">Ads</th>
                  <th className="px-4 py-3">Verified</th>
                  <th className="px-4 py-3">Disabled</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Last sign-in</th>
                  <th className="px-4 py-3">Storage</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.uid} className="border-t border-white/8 text-text-secondary">
                    <td className="px-4 py-4 align-top">
                      <div className="font-semibold text-text-primary">{user.displayName ?? 'Unnamed user'}</div>
                      <div className="mt-1 break-all text-xs text-text-secondary">{user.email ?? 'No email'}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {!user.hasProfileDoc ? (
                          <span className="inline-flex rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-300">
                            No profile doc
                          </span>
                        ) : null}
                        {user.providerIds.length > 0 ? (
                          <span className="inline-flex rounded-full border border-white/10 bg-black/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                            {user.providerIds.join(', ')}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 break-all text-[11px] uppercase tracking-[0.18em] text-text-muted">
                        {user.uid}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="font-semibold text-text-primary">{user.accountType || 'unknown'}</div>
                      <div className="mt-1 text-xs text-text-muted">{user.plan}</div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="text-text-primary">{formatStorageBytes(user.storageLimitBytes)}</div>
                      <div className="mt-1 text-xs text-text-muted">Cue daily: {user.cueDailyLimit ?? '—'}</div>
                      <div className="mt-1 text-xs text-text-muted">
                        Schedule imports: {user.scheduleImageImportsMonthly ?? '—'}/month
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="text-text-primary">
                        Cue today: {user.cueRequestsUsedToday ?? 0} / {user.cueDailyLimit ?? '—'}
                      </div>
                      <div className="mt-1 text-xs text-text-muted">
                        Images this month: {user.scheduleImageImportsUsedThisMonth ?? 0} /{' '}
                        {user.scheduleImageImportsMonthly ?? '—'}
                      </div>
                      <div className="mt-1 text-xs text-text-muted">
                        Storage: {formatStorageUsage(user).label}
                      </div>
                      <div className="mt-1 text-xs text-text-muted">{formatStorageUsage(user).percent}% used</div>
                    </td>
                    <td className="px-4 py-4 align-top">{user.betaTester ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-4 align-top">{user.premiumAccess ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-4 align-top">{user.adsEnabled ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-4 align-top">{user.emailVerified ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-4 align-top">{user.disabled ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-4 align-top">{formatAdminDate(user.createdAt)}</td>
                    <td className="px-4 py-4 align-top">{formatAdminDate(user.lastLogin)}</td>
                    <td className="px-4 py-4 align-top">
                      <div className="text-text-primary">{formatStorageUsage(user).label}</div>
                      <div className="mt-1 text-xs text-text-muted">{formatStorageUsage(user).percent}% used</div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex min-w-[220px] items-center gap-2">
                        <select
                          value={planDrafts[user.uid] ?? user.plan}
                          onChange={(event) =>
                            setPlanDrafts((current) => ({
                              ...current,
                              [user.uid]: event.target.value,
                            }))
                          }
                          className="h-10 min-w-[110px] rounded-xl border border-white/10 bg-black/10 px-3 text-sm text-text-primary outline-none transition focus:border-accent/35"
                          disabled={pendingUid === user.uid}
                        >
                          <option value="free">Free</option>
                          <option value="beta">Beta</option>
                          <option value="premium">Premium</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => void updatePlan(user)}
                          disabled={pendingUid === user.uid}
                          className="rounded-xl border border-accent/25 bg-accent/15 px-3 py-2 text-sm font-semibold text-text-primary transition hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {pendingUid === user.uid ? 'Saving...' : 'Update'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
