export const STUDY_TOOLS_TIMEZONE = 'Asia/Manila';

/** Usage day key in Philippines time (YYYY-MM-DD). */
export function studyToolsDateKey(iso = new Date().toISOString()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: STUDY_TOOLS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

/** Next midnight in Asia/Manila as ISO string. */
export function nextStudyToolsResetAtIso(iso = new Date().toISOString()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: STUDY_TOOLS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  const year = read('year');
  const month = read('month');
  const day = read('day');

  const manilaNow = new Date(
    `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00+08:00`,
  );
  const offsetMs = new Date(iso).getTime() - manilaNow.getTime();
  const manilaDate = new Date(new Date(iso).getTime() - offsetMs);

  const nextMidnightManila = new Date(
    Date.UTC(manilaDate.getUTCFullYear(), manilaDate.getUTCMonth(), manilaDate.getUTCDate() + 1, 0, 0, 0) -
      8 * 60 * 60 * 1000,
  );

  return nextMidnightManila.toISOString();
}

export function formatStudyToolsResetLabel(resetAtIso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: STUDY_TOOLS_TIMEZONE,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(resetAtIso));
  } catch {
    return '12:00 AM';
  }
}

export function studyToolsLimitMessage(used: number, limit: number, resetAtIso: string): string {
  const timeLabel = formatStudyToolsResetLabel(resetAtIso);
  return `You've used ${used}/${limit} Study Tools generations today. Refreshes at ${timeLabel} (Philippines).`;
}

export function studyToolsRateLimitMessage(resetAtIso: string): string {
  const timeLabel = formatStudyToolsResetLabel(resetAtIso);
  return `You've reached your daily Study Tools generation limit. It refreshes at ${timeLabel} (Philippines).`;
}
