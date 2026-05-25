import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';

import { dateKeyFromIso, isoNow, writeSecurityLog } from '@/lib/admin-log';
import { getFirebaseAdminDb, readFirebaseAdminStatus } from '@/lib/firebase-admin';

const PROVIDER_PRICING_USD_PER_MILLION: Record<string, { input: number; output: number }> = {
  groq: { input: 0.59, output: 0.79 },
  gemini: { input: 0.1, output: 0.4 },
  test: { input: 0, output: 0 },
};

const IS_DEV = process.env.NODE_ENV !== 'production';

export type CueUsageLogParams = {
  uid: string;
  email?: string | null;
  authenticated?: boolean;
  provider: string;
  model: string;
  status: 'success' | 'error' | 'rate_limited';
  inputTokensEstimate: number;
  outputTokensEstimate: number;
  totalTokensEstimate: number;
  estimatedCostUsd: number;
  estimatedCostPhp: number;
  errorCode?: string | null;
};

export function estimateTokensFromText(text: string): number {
  const normalized = text.trim();
  if (!normalized) return 0;
  return Math.max(1, Math.ceil(normalized.length / 4));
}

export function estimateTokensFromCuePayload(payload: unknown): number {
  if (!payload || typeof payload !== 'object') return 0;
  const object = payload as {
    history?: Array<{ parts?: Array<Record<string, unknown>> }>;
    latestUserMessage?: { parts?: Array<Record<string, unknown>> };
    systemInstruction?: string;
    messages?: Array<{ content?: unknown }>;
  };

  if (Array.isArray(object.messages)) {
    return object.messages.reduce((sum, message) => {
      if (typeof message.content === 'string') return sum + estimateTokensFromText(message.content);
      if (Array.isArray(message.content)) {
        return (
          sum +
          message.content.reduce((partSum, part) => {
            if (!part || typeof part !== 'object') return partSum;
            if ('text' in part && typeof part.text === 'string') {
              return partSum + estimateTokensFromText(part.text);
            }
            return partSum + 128;
          }, 0)
        );
      }
      return sum;
    }, 0);
  }

  let total =
    typeof object.systemInstruction === 'string' ? estimateTokensFromText(object.systemInstruction) : 0;
  const parts = [...(object.history ?? []), object.latestUserMessage ?? null].filter(Boolean);
  for (const item of parts) {
    for (const part of item?.parts ?? []) {
      if (typeof part.text === 'string') total += estimateTokensFromText(part.text);
      else if (part.inlineData) total += 256;
    }
  }
  return total;
}

export function estimateUsdCost(params: {
  provider: string;
  inputTokens: number;
  outputTokens: number;
}): number {
  const pricing = PROVIDER_PRICING_USD_PER_MILLION[params.provider] ?? PROVIDER_PRICING_USD_PER_MILLION.gemini;
  return (
    (params.inputTokens / 1_000_000) * pricing.input +
    (params.outputTokens / 1_000_000) * pricing.output
  );
}

export async function logCueUsage(params: CueUsageLogParams) {
  if (!readFirebaseAdminStatus().configured) {
    if (IS_DEV) {
      console.warn('[ai-usage-log-skipped]', {
        reason: 'firebase_admin_not_configured',
        provider: params.provider,
        status: params.status,
      });
    }
    return false;
  }

  const createdAt = isoNow();
  const dateKey = dateKeyFromIso(createdAt);
  const uid = params.uid?.trim() || 'anonymous';
  const db = getFirebaseAdminDb();
  const batch = db.batch();
  const logRef = db.collection('aiUsageLogs').doc();

  if (IS_DEV) {
    console.info('[ai-usage-log] prepare write', {
      uidDetected: uid !== 'anonymous' && uid !== 'unknown',
      provider: params.provider,
      model: params.model,
      status: params.status,
      inputTokensEstimate: params.inputTokensEstimate,
      outputTokensEstimate: params.outputTokensEstimate,
      dateKey,
    });
  }

  batch.set(logRef, {
    uid,
    email: params.email ?? null,
    authenticated: params.authenticated ?? uid !== 'anonymous',
    provider: params.provider,
    model: params.model,
    status: params.status,
    inputTokensEstimate: params.inputTokensEstimate,
    outputTokensEstimate: params.outputTokensEstimate,
    totalTokensEstimate: params.totalTokensEstimate,
    estimatedCostUsd: params.estimatedCostUsd,
    estimatedCostPhp: params.estimatedCostPhp,
    dateKey,
    createdAt,
    errorCode: params.errorCode ?? null,
    serverTimestamp: FieldValue.serverTimestamp(),
  });

  const aggregatePayload = {
    dateKey,
    totalRequests: FieldValue.increment(1),
    totalTokens: FieldValue.increment(params.totalTokensEstimate),
    totalEstimatedCostUsd: FieldValue.increment(params.estimatedCostUsd),
    totalEstimatedCostPhp: FieldValue.increment(params.estimatedCostPhp),
    requests: FieldValue.increment(1),
    totalTokensEstimate: FieldValue.increment(params.totalTokensEstimate),
    estimatedCostUsd: FieldValue.increment(params.estimatedCostUsd),
    estimatedCostPhp: FieldValue.increment(params.estimatedCostPhp),
    inputTokensEstimate: FieldValue.increment(params.inputTokensEstimate),
    outputTokensEstimate: FieldValue.increment(params.outputTokensEstimate),
    updatedAt: createdAt,
    serverTimestamp: FieldValue.serverTimestamp(),
    errorCount: FieldValue.increment(params.status === 'error' ? 1 : 0),
    errors: FieldValue.increment(params.status === 'error' ? 1 : 0),
    rateLimitHits: FieldValue.increment(params.status === 'rate_limited' ? 1 : 0),
    groqRequests: FieldValue.increment(params.provider === 'groq' ? 1 : 0),
    groqInputTokens: FieldValue.increment(params.provider === 'groq' ? params.inputTokensEstimate : 0),
    groqOutputTokens: FieldValue.increment(params.provider === 'groq' ? params.outputTokensEstimate : 0),
    groqTotalTokens: FieldValue.increment(params.provider === 'groq' ? params.totalTokensEstimate : 0),
    groqEstimatedCostUsd: FieldValue.increment(params.provider === 'groq' ? params.estimatedCostUsd : 0),
    geminiRequests: FieldValue.increment(params.provider === 'gemini' ? 1 : 0),
    geminiInputTokens: FieldValue.increment(params.provider === 'gemini' ? params.inputTokensEstimate : 0),
    geminiOutputTokens: FieldValue.increment(params.provider === 'gemini' ? params.outputTokensEstimate : 0),
    geminiTotalTokens: FieldValue.increment(params.provider === 'gemini' ? params.totalTokensEstimate : 0),
    geminiEstimatedCostUsd: FieldValue.increment(params.provider === 'gemini' ? params.estimatedCostUsd : 0),
    providerGroqRequests: FieldValue.increment(params.provider === 'groq' ? 1 : 0),
    providerGeminiRequests: FieldValue.increment(params.provider === 'gemini' ? 1 : 0),
  };

  batch.set(db.doc(`adminMetrics/aiUsage/daily/${dateKey}`), aggregatePayload, { merge: true });
  batch.set(db.doc(`users/${uid}/usage/${dateKey}`), aggregatePayload, { merge: true });
  await batch.commit();

  if (IS_DEV) {
    console.info('[ai-usage-log] wrote aiUsageLogs', { dateKey, provider: params.provider, status: params.status });
    console.info('[ai-usage-log] updated daily aggregate', { dateKey });
  }

  if (params.status !== 'success') {
    await writeSecurityLog({
      severity: params.status === 'rate_limited' ? 'warning' : 'error',
      actorUid: uid,
      actorEmail: params.email ?? null,
      action: params.status === 'rate_limited' ? 'cue_rate_limited' : 'cue_request_error',
      target: `provider:${params.provider}`,
      category: 'ai',
      details: {
        model: params.model,
        errorCode: params.errorCode ?? null,
        totalTokensEstimate: params.totalTokensEstimate,
      },
    }).catch(() => {});
  }

  return true;
}
