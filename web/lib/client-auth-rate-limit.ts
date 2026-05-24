const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 10;

type AttemptWindow = {
  count: number;
  resetAt: number;
};

function storageKey(scope: 'login' | 'register') {
  return `studycue.auth-rate-limit.${scope}`;
}

function readWindow(scope: 'login' | 'register'): AttemptWindow | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(storageKey(scope));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<AttemptWindow>;
    if (
      typeof parsed.count === 'number' &&
      Number.isFinite(parsed.count) &&
      typeof parsed.resetAt === 'number' &&
      Number.isFinite(parsed.resetAt)
    ) {
      return { count: parsed.count, resetAt: parsed.resetAt };
    }
  } catch {
    return null;
  }
  return null;
}

function writeWindow(scope: 'login' | 'register', value: AttemptWindow) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey(scope), JSON.stringify(value));
}

export function consumeAuthAttempt(scope: 'login' | 'register') {
  const now = Date.now();
  const existing = readWindow(scope);

  if (!existing || existing.resetAt <= now) {
    const next = { count: 1, resetAt: now + WINDOW_MS };
    writeWindow(scope, next);
    return { allowed: true as const, remaining: LIMIT - 1, retryAfterMs: WINDOW_MS };
  }

  if (existing.count >= LIMIT) {
    return {
      allowed: false as const,
      remaining: 0,
      retryAfterMs: Math.max(1, existing.resetAt - now),
    };
  }

  const next = { ...existing, count: existing.count + 1 };
  writeWindow(scope, next);
  return {
    allowed: true as const,
    remaining: Math.max(0, LIMIT - next.count),
    retryAfterMs: Math.max(1, next.resetAt - now),
  };
}

export function authRateLimitMessage(retryAfterMs: number) {
  const minutes = Math.max(1, Math.ceil(retryAfterMs / 60000));
  return `Too many attempts. Please wait about ${minutes} minute${minutes === 1 ? '' : 's'} before trying again.`;
}
