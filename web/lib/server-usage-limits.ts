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
      reason?: never;
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

async function reserveScheduleImageCueUsage(
  uid: string,
  requestId?: string | null,
): Promise<{ daily: UsageDecision; scheduleImage: UsageDecision }> {
  const limits = await getPlanLimitsByUid(uid);
  const createdAt = isoNow();
  const now = new Date(createdAt);
  const dateKey = dateKeyFromIso(createdAt);
  const monthKey = monthKeyFromIso(createdAt);
  const dailyLimit = limits.cueDailyLimit;
  const scheduleLimit = limits.scheduleImageImportsMonthly;
  const dailyResetAt = nextUtcDayIso(now);
  const scheduleResetAt = nextUtcMonthIso(now);

  if (!readFirebaseAdminStatus().configured) {
    if (IS_DEV) {
      console.warn('[usage-limit] admin db unavailable; skipping schedule image cue enforcement');
    }
    return {
      daily: { allowed: true, used: 0, limit: dailyLimit, dateKey, resetAt: dailyResetAt },
      scheduleImage: {
        allowed: true,
        used: 0,
        limit: scheduleLimit,
        monthKey,
        resetAt: scheduleResetAt,
      },
    };
  }

  const db = getFirebaseAdminDb();
  const dailyRef = db.doc(`users/${uid}/usage/${dateKey}`);
  const scheduleRef = db.doc(`users/${uid}/usage/${monthKey}`);
  const requestRef = requestId?.trim() ? db.doc(`users/${uid}/usageRequests/${requestId.trim()}`) : null;

  const result = await db.runTransaction(async (transaction) => {
    const [dailySnapshot, scheduleSnapshot, requestSnapshot] = await Promise.all([
      transaction.get(dailyRef),
      transaction.get(scheduleRef),
      requestRef ? transaction.get(requestRef) : Promise.resolve(null),
    ]);

    const dailyData = dailySnapshot.data() as Record<string, unknown> | undefined;
    const scheduleData = scheduleSnapshot.data() as Record<string, unknown> | undefined;
    const requestData = (requestSnapshot?.data() ?? {}) as Record<string, unknown>;
    const dailyUsed = typeof dailyData?.cueRequestsUsed === 'number' ? dailyData.cueRequestsUsed : 0;
    const scheduleUsed =
      typeof scheduleData?.scheduleImageImportsUsed === 'number'
        ? scheduleData.scheduleImageImportsUsed
        : 0;
    const dailyAlreadyCounted = requestData.cueDailyCountedDateKey === dateKey;
    const scheduleAlreadyCounted = requestData.scheduleImageCountedMonthKey === monthKey;

    if (!dailyAlreadyCounted && dailyUsed >= dailyLimit) {
      return {
        daily: {
          allowed: false as const,
          used: dailyUsed,
          limit: dailyLimit,
          dateKey,
          resetAt: dailyResetAt,
          reason: 'cue_daily' as const,
        },
        scheduleImage: {
          allowed: true as const,
          used: scheduleUsed,
          limit: scheduleLimit,
          monthKey,
          resetAt: scheduleResetAt,
        },
      };
    }

    if (!scheduleAlreadyCounted && scheduleUsed >= scheduleLimit) {
      return {
        daily: {
          allowed: true as const,
          used: dailyUsed,
          limit: dailyLimit,
          dateKey,
          resetAt: dailyResetAt,
        },
        scheduleImage: {
          allowed: false as const,
          used: scheduleUsed,
          limit: scheduleLimit,
          monthKey,
          resetAt: scheduleResetAt,
          reason: 'schedule_image_monthly' as const,
        },
      };
    }

    const dailyIncrement = dailyAlreadyCounted ? 0 : 1;
    const scheduleIncrement = scheduleAlreadyCounted ? 0 : 1;

    if (dailyIncrement > 0) {
      transaction.set(
        dailyRef,
        {
          cueRequestsUsed: FieldValue.increment(dailyIncrement),
          cueDailyLimit: dailyLimit,
          dateKey,
          updatedAt: createdAt,
          serverTimestamp: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    if (scheduleIncrement > 0) {
      transaction.set(
        scheduleRef,
        {
          scheduleImageImportsUsed: FieldValue.increment(scheduleIncrement),
          scheduleImageImportsMonthly: scheduleLimit,
          monthKey,
          updatedAt: createdAt,
          serverTimestamp: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    if (requestRef && (dailyIncrement > 0 || scheduleIncrement > 0)) {
      transaction.set(
        requestRef,
        {
          ...(dailyIncrement > 0 ? { cueDailyCountedDateKey: dateKey } : {}),
          ...(scheduleIncrement > 0 ? { scheduleImageCountedMonthKey: monthKey } : {}),
          updatedAt: createdAt,
          serverTimestamp: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    return {
      daily: {
        allowed: true as const,
        used: dailyUsed + dailyIncrement,
        limit: dailyLimit,
        dateKey,
        resetAt: dailyResetAt,
      },
      scheduleImage: {
        allowed: true as const,
        used: scheduleUsed + scheduleIncrement,
        limit: scheduleLimit,
        monthKey,
        resetAt: scheduleResetAt,
      },
    };
  });

  if (IS_DEV) {
    console.info('[usage-limit] schedule image cue reservation', {
      uidDetected: Boolean(uid),
      dateKey,
      monthKey,
      dailyStatus: result.daily.allowed ? 'reserved' : 'blocked',
      scheduleStatus: result.scheduleImage.allowed ? 'reserved' : 'blocked',
      dailyUsed: result.daily.used,
      scheduleUsed: result.scheduleImage.used,
    });
  }

  return result;
}

export async function reserveCueRequestUsage(uid: string, body: unknown, requestId?: string | null) {
  const [planLimits, profile] = await Promise.all([getPlanLimitsByUid(uid), getUserProfileByUid(uid)]);
  const hasScheduleImage = requestHasGeminiInlineImage(body) || requestHasGroqImage(body);

  if (!hasScheduleImage) {
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

    return {
      allowed: true as const,
      planLimits,
      profile,
      daily,
      scheduleImage: null,
      isScheduleImageImport: false,
    };
  }

  const { daily, scheduleImage } = await reserveScheduleImageCueUsage(uid, requestId);
  if (!daily.allowed) {
    return {
      allowed: false as const,
      planLimits,
      profile,
      daily,
      scheduleImage,
      message: "You’ve reached your daily Cue AI limit for your plan.",
    };
  }

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
