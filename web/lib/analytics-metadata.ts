import { ANALYTICS_EVENT_TYPES, ANALYTICS_FEATURES, type AnalyticsEventType, type AnalyticsFeature } from '@/lib/analytics-types';

const ALLOWED_METADATA_KEYS = new Set([
  'source',
  'provider',
  'model',
  'status',
  'route',
  'fileType',
  'fileSizeBytes',
  'storedSizeBytes',
  'compressionSavedBytes',
  'storageUsedBytes',
  'hasScreenshot',
  'reportId',
  'sourceType',
  'count',
  'endpoint',
  'inputTokensEstimate',
  'outputTokensEstimate',
  'totalTokensEstimate',
]);

const FORBIDDEN_METADATA_KEYS = new Set([
  'text',
  'prompt',
  'response',
  'content',
  'title',
  'tasktitle',
  'notename',
  'filename',
  'calendartitle',
  'description',
  'message',
  'body',
  'screenshot',
  'screenshoturl',
  'email',
  'displayname',
  'name',
]);

function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

function coerceSafeValue(value: unknown): string | number | boolean | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.length > 120) return undefined;
    return trimmed;
  }
  return undefined;
}

/** Strip unsafe keys; only allowlisted scalar metadata passes through. */
export function sanitizeAnalyticsMetadata(
  metadata?: Record<string, unknown> | null,
): Record<string, string | number | boolean | null> {
  if (!metadata || typeof metadata !== 'object') return {};

  const safe: Record<string, string | number | boolean | null> = {};

  for (const [rawKey, rawValue] of Object.entries(metadata)) {
    const key = normalizeKey(rawKey);
    if (FORBIDDEN_METADATA_KEYS.has(key)) continue;
    if (!ALLOWED_METADATA_KEYS.has(key)) continue;
    const value = coerceSafeValue(rawValue);
    if (value === undefined) continue;
    safe[key] = value;
  }

  return safe;
}

export function isAllowedAnalyticsEventType(value: string): value is AnalyticsEventType {
  return (ANALYTICS_EVENT_TYPES as readonly string[]).includes(value);
}

export function isAllowedAnalyticsFeature(value: string): value is AnalyticsFeature {
  return (ANALYTICS_FEATURES as readonly string[]).includes(value);
}
