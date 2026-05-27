import type { AnalyticsFeature } from '@/lib/analytics-types';

/** Map authenticated app routes to privacy-safe feature ids. */
export function featureFromAppPathname(pathname: string | null | undefined): AnalyticsFeature | null {
  if (!pathname?.startsWith('/app')) return null;

  const path = pathname.split('?')[0]?.replace(/\/$/, '') || '/app';

  if (path === '/app' || path === '/app/dashboard') return 'dashboard';
  if (path.startsWith('/app/calendar')) return 'calendar';
  if (path.startsWith('/app/tasks')) return 'tasks';
  if (path.startsWith('/app/focus') || path.startsWith('/app/focus-timer')) return 'focus';
  if (path.startsWith('/app/chat')) return 'cue_ai';
  if (path.startsWith('/app/notes')) return 'notes';
  if (path.startsWith('/app/stats')) return 'stats';
  if (path.startsWith('/app/settings') || path.startsWith('/app/profile')) return 'settings';
  if (path.startsWith('/app/quiz')) return 'quiz_generator';
  if (path.startsWith('/app/flashcards')) return 'flashcards';
  if (path.startsWith('/app/file-study')) return 'file_study';
  if (path.startsWith('/app/report-bug')) return 'bug_reports';

  return 'dashboard';
}

export function routeFromAppPathname(pathname: string | null | undefined): string | null {
  const feature = featureFromAppPathname(pathname);
  if (!feature) return null;
  return pathname?.split('?')[0] ?? null;
}
