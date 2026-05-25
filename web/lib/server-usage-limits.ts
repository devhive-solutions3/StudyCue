import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';

import { dateKeyFromIso, isoNow, monthKeyFromIso } from '@/lib/admin-log';
import { getFirebaseAdminDb, readFirebaseAdminStatus } from '@/lib/firebase-admin';
import { getPlanLimitsByUid, getUserProfileByUid } from '@/lib/server-user-plan';

type UsageLimitKind = 'cue_daily' | 'schedule_image_monthly';

type UsageDecision =
  | {
      allowed: true;
      used: number;
      limit: number;
      dateKey?: string;
      monthKey?: string;
      resetAt: string;
    }
  | {
      allowed: false;
      used: number;
      limit: number;
      dateKey?: string;
      monthKey?: string;
      resetAt: string;
      reason: UsageLimitKind;
    };

const IS_DEV = process.env.NODE_ENV !== 'production';

function nextUtcDayIso(now: Date) {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return next.toISOString();
}

function nextUtcMonthIso(now: Date) {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return next.toISOString();
}

async function reserveDailyUsage(uid: string, requestId?: string | null): Promise<UsageDecision> {
  const limits = await getPlanLimitsByUid(uid);
  const createdAt = isoNow();
  const dateKey = dateKeyFromIso(createdAt);
  const limit = limits.cueDailyLimit;
  const resetAt = nextUtcDayIso(new Date(createdAt));

  if (!readFirebaseAdminStatus().configured) {
    if (IS_DEV) {
      console.warn('[usage-limit] admin db unavailable; skipping cue daily enforcement');
    }
    return { allowed: true, used: 0, limit, dateKey, resetAt };
  }

  const db = getFirebaseAdminDb();
  const ref = db.doc(`users/${uid}/usage/${dateKey}`);
  const requestRef = requestId?.trim() ? db.doc(`users/${uid}/usageRequests/${requestId.trim()}`) : null;
  const result = await db.runTransaction(async (transaction) => {
    const [snapshot, requestSnapshot] = await Promise.all([
      transaction.get(ref),
      requestRef ? transaction.get(requestRef) : Promise.resolve(null),
    ]);
    const current = snapshot.data() as Record<string, unknown> | undefined;
    const used = typeof current?.cueRequestsUsed === 'number' ? current.cueRequestsUsed : 0;
    const requestData = (requestSnapshot?.data() ?? {}) as Record<string, unknown>;

    if (requestRef && requestData.cueDailyCountedDateKey === dateKey) {
      return { allowed: true as const, used, limit, dateKey, resetAt };
    }

    if (used >= limit) {
      return { allowed: false as const, used, limit, dateKey, resetAt, reason: 'cue_daily' as const };
    }

    transaction.set(
      ref,
      {
        cueRequestsUsed: FieldValue.increment(1),
        cueDailyLimit: limit,
        dateKey,
        updatedAt: createdAt,
        serverTimestamp: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    if (requestRef) {
      transaction.set(
        requestRef,
        {
          cueDailyCountedDateKey: dateKey,
          updatedAt: createdAt,
          serverTimestamp: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
    return { allowed: true as const, used: used + 1, limit, dateKey, resetAt };
  });

  if (IS_DEV) {
    console.info('[usage-limit] cue daily reservation', {
      uidDetected: Boolean(uid),
      status: result.allowed ? 'reserved' : 'blocked',
      dateKey,
      limit,
      used: result.used,
    });
  }

  return result;
}

function requestHasGeminiInlineImage(body: unknown) {
  if (!body || typeof body !== 'object') return false;
  const latestParts = (body as { latestUserMessage?: { parts?: Array<Record<string, unknown>> } }).latestUserMessage
    ?.parts;
  return Array.isArray(latestParts)
    ? latestParts.some((part) => part && typeof part === 'object' && 'inlineData' in part)
    : false;
}

function requestHasGroqImage(body: unknown) {
  if (!body || typeof body !== 'object') return false;
  const messages = (body as { messages?: Array<{ role?: string; content?: unknown }> }).messages;
  if (!Array.isArray(messages)) return false;
  return messages.some((message) => {
    if (message?.role !== 'user' || !Array.isArray(message.content)) return false;
    return message.content.some(
      (part) =>
        part &&
        typeof part === 'object' &&
        'type' in part &&
        (part as { type?: string }).type === 'image_url',
    );
  });
}

async function reserveMonthlyScheduleImageImport(
  uid: string,
  requestId?: string | null,
): Promise<UsageDecision> {
  const limits = await getPlanLimitsByUid(uid);
  const createdAt = isoNow();
  const monthKey = monthKeyFromIso(createdAt);
  const limit = limits.scheduleImageImportsMonthly;
  const resetAt = nextUtcMonthIso(new Date(createdAt));

  if (!readFirebaseAdminStatus().configured) {
    if (IS_DEV) {
      console.warn('[usage-limit] admin db unavailable; skipping schedule image enforcement');
    }
    return { allowed: true, used: 0, limit, monthKey, resetAt };
  }

  const db = getFirebaseAdminDb();
  const ref = db.doc(`users/${uid}/usage/${monthKey}`);
  const requestRef = requestId?.trim() ? db.doc(`users/${uid}/usageRequests/${requestId.trim()}`) : null;
  const result = await db.runTransaction(async (transaction) => {
    const [snapshot, requestSnapshot] = await Promise.all([
      transaction.get(ref),
      requestRef ? transaction.get(requestRef) : Promise.resolve(null),
    ]);
    const current = snapshot.data() as Record<string, unknown> | undefined;
    const used =
      typeof current?.scheduleImageImportsUsed === 'number' ? current.scheduleImageImportsUsed : 0;
    const requestData = (requestSnapshot?.data() ?? {}) as Record<string, unknown>;

    if (requestRef && requestData.scheduleImageCountedMonthKey === monthKey) {
      return { allowed: true as const, used, limit, monthKey, resetAt };
    }

    if (used >= limit) {
      return {
        allowed: false as const,
        used,
        limit,
        monthKey,
        resetAt,
        reason: 'schedule_image_monthly' as const,
      };
    }

    transaction.set(
      ref,
      {
        scheduleImageImportsUsed: FieldValue.increment(1),
        scheduleImageImportsMonthly: limit,
        monthKey,
        updatedAt: createdAt,
        serverTimestamp: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    if (requestRef) {
      transaction.set(
        requestRef,
        {
          scheduleImageCountedMonthKey: monthKey,
          updatedAt: createdAt,
          serverTimestamp: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
    return { allowed: true as const, used: used + 1, limit, monthKey, resetAt };
  });

  if (IS_DEV) {
    console.info('[usage-limit] schedule image reservation', {
      uidDetected: Boolean(uid),
      status: result.allowed ? 'reserved' : 'blocked',
      monthKey,
      limit,
      used: result.used,
    });
  }

  return result;
}

export async function reserveCueRequestUsage(uid: string, body: unknown, requestId?: string | null) {
  const [planLimits, profile] = await Promise.all([getPlanLimitsByUid(uid), getUserProfileByUid(uid)]);
  const daily = await reserveDailyUsage(uid, requestId);
  if (!daily.allowed) {
    return {
      allowed: false as const,
      planLimits,
      profile,
      daily,
      scheduleImage: null,
      message: "You’ve reached your daily Cue AI limit for your plan.",
    };
  }

  const hasScheduleImage = requestHasGeminiInlineImage(body) || requestHasGroqImage(body);
  if (!hasScheduleImage) {
    return {
      allowed: true as const,
      planLimits,
      profile,
      daily,
      scheduleImage: null,
      isScheduleImageImport: false,
    };
  }

  const scheduleImage = await reserveMonthlyScheduleImageImport(uid, requestId);
  if (!scheduleImage.allowed) {
    return {
      allowed: false as const,
      planLimits,
      profile,
      daily,
      scheduleImage,
      message: "You’ve reached your monthly schedule image import limit.",
    };
  }

  return {
    allowed: true as const,
    planLimits,
    profile,
    daily,
    scheduleImage,
    isScheduleImageImport: true,
  };
}
