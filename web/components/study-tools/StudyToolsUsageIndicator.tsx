'use client';

import { useEffect, useState } from 'react';

import { formatCountdownDuration } from '@/lib/study-tools-time';

type UsageState = {
  used: number;
  limit: number;
  resetAt: string;
  resetLabel: string;
  secondsUntilReset?: number;
};

export default function StudyToolsUsageIndicator({ className = '' }: { className?: string }) {
  const [usage, setUsage] = useState<UsageState | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/study-tools/usage', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.usage) return;
        const u = data.usage as UsageState;
        setUsage({
          used: u.used,
          limit: u.limit,
          resetAt: u.resetAt,
          resetLabel: u.resetLabel,
          secondsUntilReset: u.secondsUntilReset,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!usage || usage.limit <= 0) return null;

  const atLimit = usage.used >= usage.limit;
  const countdown =
    typeof usage.secondsUntilReset === 'number'
      ? formatCountdownDuration(usage.secondsUntilReset)
      : null;

  return (
    <p
      className={`text-xs ${atLimit ? 'text-amber-700 dark:text-amber-200' : 'text-text-muted'} ${className}`.trim()}
    >
      Study tools today: {usage.used} / {usage.limit}
      <span className="mx-1">·</span>
      Refreshes at {usage.resetLabel} (PH)
      {atLimit && countdown ? (
        <>
          <span className="mx-1">·</span>
          Limit reached, in {countdown}
        </>
      ) : null}
    </p>
  );
}
