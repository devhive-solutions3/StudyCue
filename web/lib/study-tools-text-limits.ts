/** Character thresholds for Study Tools AI input preparation. */

export const DIRECT_GENERATION_MAX_CHARS = 20_000;
export const CONDENSE_MAX_CHARS = 60_000;
export const ABSOLUTE_MAX_CHARS = 100_000;

/** Max characters sent to extraction APIs / stored in session (legacy cap). */
export const STUDY_EXTRACT_CAP_CHARS = 60_000;

export const STUDY_CHUNK_TARGET_CHARS = 10_000;
export const STUDY_MAX_CONDENSE_CHUNKS = 8;

export function estimateStudyInputTokens(charCount: number): number {
  return Math.max(1, Math.ceil(charCount / 4));
}

export function isLargeStudySource(charCount: number): boolean {
  return charCount > DIRECT_GENERATION_MAX_CHARS;
}

export function largeSourceUserNotice(charCount: number): string | null {
  if (charCount > ABSOLUTE_MAX_CHARS) return null;
  if (charCount > CONDENSE_MAX_CHARS) {
    return 'Large file detected. We will condense it before generating.';
  }
  if (charCount > DIRECT_GENERATION_MAX_CHARS) {
    return 'Large source detected. Generation may take longer.';
  }
  if (charCount >= STUDY_EXTRACT_CAP_CHARS) {
    return 'Using the first 60,000 characters.';
  }
  return null;
}
