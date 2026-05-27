export const STUDY_TOOLS_PLAN_DENIED_MESSAGE =
  'This study tool is available for Beta and StudyCue Plus users.';

/** Shared headers for study-tool API calls (auth cookie + dedupe id). */
export function studyToolsFetchHeaders(
  extra?: Record<string, string>,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  };
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    headers['x-studycue-request-id'] = crypto.randomUUID();
  }
  return headers;
}

export const STUDY_TOOLS_DAILY_LIMIT_MESSAGE =
  "You've reached your daily AI limit for your plan.";
