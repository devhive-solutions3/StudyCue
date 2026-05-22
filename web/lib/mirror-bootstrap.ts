import type { CloudMirrorV1 } from '@studycue/types';

/** Default prefs match mobile sane defaults when building a mirror on web. */
export function emptyMirror(): CloudMirrorV1 {
  return {
    schemaVersion: 1,
    taskCategories: [{ id: 1, name: 'General', slug: 'general' }],
    classes: [],
    tasks: [],
    sessions: [],
    noteFolders: [],
    noteFiles: [],
    preferences: {
      preferredFocusMinutes: 25,
      preferredBreakMinutes: 5,
      dailyGoalMinutes: 120,
      energyMode: 'standard',
    },
  };
}

export function normalizeMirror(parsed: CloudMirrorV1): CloudMirrorV1 {
  if (parsed.schemaVersion !== 1) return emptyMirror();
  const categories =
    parsed.taskCategories?.length > 0
      ? [...parsed.taskCategories]
      : [{ id: 1, name: 'General', slug: 'general' }];

  const base = emptyMirror();

  return {
    schemaVersion: 1,
    taskCategories: categories,
    classes: parsed.classes ?? [],
    tasks: parsed.tasks ?? [],
    sessions: parsed.sessions ?? [],
    noteFolders: parsed.noteFolders ?? [],
    noteFiles: parsed.noteFiles ?? [],
    preferences: parsed.preferences ?? base.preferences,
  };
}

export function nextNumericId(rows: readonly { id: number }[]): number {
  if (!rows.length) return 1;
  return rows.reduce((m, r) => Math.max(m, r.id), 0) + 1;
}

const WEEKDAY_ORDER = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export function orderedWeekdays(): readonly string[] {
  return WEEKDAY_ORDER;
}

export function weekdayRank(w: string | null | undefined): number {
  if (!w) return 999;
  const i = WEEKDAY_ORDER.findIndex((d) => d.toLowerCase() === w.trim().toLowerCase());
  return i === -1 ? 998 : i;
}
