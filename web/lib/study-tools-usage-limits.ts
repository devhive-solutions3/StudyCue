import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';

import { isoNow } from '@/lib/admin-log';
import { getFirebaseAdminDb, readFirebaseAdminStatus } from '@/lib/firebase-admin';
import { getPlanLimitsByUid } from '@/lib/server-user-plan';
import { getStudyToolDailyLimit } from '@/lib/plan-access';
import { getUserPlanByUid } from '@/lib/server-user-plan';
import {
  formatStudyToolsResetLabel,
  nextStudyToolsResetAtIso,
  secondsUntilStudyToolsReset,
  studyToolsDateKey,
  studyToolsRateLimitMessage,
} from '@/lib/study-tools-time';

export type StudyToolKind = 'quiz' | 'flashcards' | 'file_study';

export type StudyToolSourceSurface =
  | 'quiz_page'
  | 'flashcards_page'
  | 'cue_ai'
  | 'notes'
  | 'unknown';

export type StudyToolsUsageSnapshot = {
  used: number;
  limit: number;
  quizGenerationsUsed: number;
  flashcardGenerationsUsed: number;
  fileStudyGenerationsUsed: number;
  resetAt: string;
  resetLabel: string;
  secondsUntilReset: number;
  dateKey: string;
};

const IS_DEV = process.env.NODE_ENV !== 'production';

function counterFieldForTool(tool: StudyToolKind): string {
  if (tool === 'quiz') return 'quizGenerationsUsed';
  if (tool === 'flashcards') return 'flashcardGenerationsUsed';
  return 'fileStudyGenerationsUsed';
}

function summaryCounterForTool(tool: StudyToolKind, sourceSurface: StudyToolSourceSurface): string {
  if (tool === 'quiz' && sourceSurface === 'cue_ai') return 'totalCueQuizGenerations';
  if (tool === 'flashcards' && sourceSurface === 'cue_ai') return 'totalCueFlashcardGenerations';
  if (tool === 'quiz') return 'totalQuizGenerations';
  if (tool === 'flashcards') return 'totalFlashcardGenerations';
  return 'totalFileStudyGenerations';
}

export async function readStudyToolsUsage(uid: string): Promise<StudyToolsUsageSnapshot> {
  const plan = await getUserPlanByUid(uid);
  const limit = getStudyToolDailyLimit({ plan });
  const createdAt = isoNow();
  const dateKey = studyToolsDateKey(createdAt);
  const resetAt = nextStudyToolsResetAtIso(createdAt);

  if (!readFirebaseAdminStatus().configured) {
    return {
      used: 0,
      limit,
      quizGenerationsUsed: 0,
      flashcardGenerationsUsed: 0,
      fileStudyGenerationsUsed: 0,
      resetAt,
      resetLabel: formatStudyToolsResetLabel(resetAt),
      secondsUntilReset: secondsUntilStudyToolsReset(resetAt),
      dateKey,
    };
  }

  const snapshot = await getFirebaseAdminDb().doc(`users/${uid}/usage/${dateKey}`).get();
  const data = (snapshot.data() ?? {}) as Record<string, unknown>;
  const used = typeof data.studyToolGenerationsUsed === 'number' ? data.studyToolGenerationsUsed : 0;

  return {
    used,
    limit,
    quizGenerationsUsed: typeof data.quizGenerationsUsed === 'number' ? data.quizGenerationsUsed : 0,
    flashcardGenerationsUsed:
      typeof data.flashcardGenerationsUsed === 'number' ? data.flashcardGenerationsUsed : 0,
    fileStudyGenerationsUsed:
      typeof data.fileStudyGenerationsUsed === 'number' ? data.fileStudyGenerationsUsed : 0,
    resetAt: typeof data.studyToolsResetAt === 'string' ? data.studyToolsResetAt : resetAt,
    resetLabel: formatStudyToolsResetLabel(
      typeof data.studyToolsResetAt === 'string' ? data.studyToolsResetAt : resetAt,
    ),
    secondsUntilReset: secondsUntilStudyToolsReset(
      typeof data.studyToolsResetAt === 'string' ? data.studyToolsResetAt : resetAt,
    ),
    dateKey,
  };
}

export async function reserveStudyToolGeneration(params: {
  uid: string;
  tool: StudyToolKind;
  sourceSurface: StudyToolSourceSurface;
  requestId?: string | null;
}): Promise<
  | { allowed: true; daily: StudyToolsUsageSnapshot; userPlan: Awaited<ReturnType<typeof getUserPlanByUid>> }
  | { allowed: false; daily: StudyToolsUsageSnapshot; message: string }
> {
  const [planLimits, plan] = await Promise.all([getPlanLimitsByUid(params.uid), getUserPlanByUid(params.uid)]);
  const limit = getStudyToolDailyLimit({ plan });
  const createdAt = isoNow();
  const dateKey = studyToolsDateKey(createdAt);
  const resetAt = nextStudyToolsResetAtIso(createdAt);

  if (limit <= 0) {
    const daily: StudyToolsUsageSnapshot = {
      used: 0,
      limit: 0,
      quizGenerationsUsed: 0,
      flashcardGenerationsUsed: 0,
      fileStudyGenerationsUsed: 0,
      resetAt,
      resetLabel: formatStudyToolsResetLabel(resetAt),
      secondsUntilReset: secondsUntilStudyToolsReset(resetAt),
      dateKey,
    };
    return { allowed: false, daily, message: 'Study tools are not available on your plan.' };
  }

  if (!readFirebaseAdminStatus().configured) {
    if (IS_DEV) console.warn('[study-tools-usage] admin db unavailable; skipping enforcement');
    const daily: StudyToolsUsageSnapshot = {
      used: 0,
      limit,
      quizGenerationsUsed: 0,
      flashcardGenerationsUsed: 0,
      fileStudyGenerationsUsed: 0,
      resetAt,
      resetLabel: formatStudyToolsResetLabel(resetAt),
      secondsUntilReset: secondsUntilStudyToolsReset(resetAt),
      dateKey,
    };
    return { allowed: true, daily, userPlan: plan };
  }

  const db = getFirebaseAdminDb();
  const usageRef = db.doc(`users/${params.uid}/usage/${dateKey}`);
  const summaryRef = db.doc(`users/${params.uid}/usageSummary/studyTools`);
  const requestRef = params.requestId?.trim()
    ? db.doc(`users/${params.uid}/usageRequests/${params.requestId.trim()}`)
    : null;
  const toolField = counterFieldForTool(params.tool);
  const summaryField = summaryCounterForTool(params.tool, params.sourceSurface);

  const result = await db.runTransaction(async (transaction) => {
    const [usageSnap, requestSnap] = await Promise.all([
      transaction.get(usageRef),
      requestRef ? transaction.get(requestRef) : Promise.resolve(null),
    ]);

    const usageData = (usageSnap.data() ?? {}) as Record<string, unknown>;
    const used =
      typeof usageData.studyToolGenerationsUsed === 'number' ? usageData.studyToolGenerationsUsed : 0;
    const requestData = (requestSnap?.data() ?? {}) as Record<string, unknown>;
    const alreadyCounted = requestData.studyToolCountedDateKey === dateKey;

    if (!alreadyCounted && used >= limit) {
      return {
        allowed: false as const,
        used,
        limit,
        quizGenerationsUsed:
          typeof usageData.quizGenerationsUsed === 'number' ? usageData.quizGenerationsUsed : 0,
        flashcardGenerationsUsed:
          typeof usageData.flashcardGenerationsUsed === 'number'
            ? usageData.flashcardGenerationsUsed
            : 0,
        fileStudyGenerationsUsed:
          typeof usageData.fileStudyGenerationsUsed === 'number' ? usageData.fileStudyGenerationsUsed : 0,
      };
    }

    if (!alreadyCounted) {
      transaction.set(
        usageRef,
        {
          studyToolGenerationsUsed: FieldValue.increment(1),
          [toolField]: FieldValue.increment(1),
          studyToolDailyLimit: limit,
          cueDailyLimit: planLimits.cueDailyLimit,
          studyToolsResetAt: resetAt,
          dateKey,
          updatedAt: createdAt,
          serverTimestamp: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      transaction.set(
        summaryRef,
        {
          [summaryField]: FieldValue.increment(1),
          lastGeneratedAt: createdAt,
          updatedAt: createdAt,
          serverTimestamp: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      if (requestRef) {
        transaction.set(
          requestRef,
          {
            studyToolCountedDateKey: dateKey,
            updatedAt: createdAt,
            serverTimestamp: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }
    }

    return {
      allowed: true as const,
      used: alreadyCounted ? used : used + 1,
      limit,
      quizGenerationsUsed:
        (typeof usageData.quizGenerationsUsed === 'number' ? usageData.quizGenerationsUsed : 0) +
        (!alreadyCounted && params.tool === 'quiz' ? 1 : 0),
      flashcardGenerationsUsed:
        (typeof usageData.flashcardGenerationsUsed === 'number'
          ? usageData.flashcardGenerationsUsed
          : 0) + (!alreadyCounted && params.tool === 'flashcards' ? 1 : 0),
      fileStudyGenerationsUsed:
        (typeof usageData.fileStudyGenerationsUsed === 'number' ? usageData.fileStudyGenerationsUsed : 0) +
        (!alreadyCounted && params.tool === 'file_study' ? 1 : 0),
    };
  });

  const daily: StudyToolsUsageSnapshot = {
    used: result.used,
    limit: result.limit,
    quizGenerationsUsed: result.quizGenerationsUsed,
    flashcardGenerationsUsed: result.flashcardGenerationsUsed,
    fileStudyGenerationsUsed: result.fileStudyGenerationsUsed,
    resetAt,
    resetLabel: formatStudyToolsResetLabel(resetAt),
    secondsUntilReset: secondsUntilStudyToolsReset(resetAt),
    dateKey,
  };

  if (!result.allowed) {
    return { allowed: false, daily, message: studyToolsRateLimitMessage(resetAt) };
  }

  if (IS_DEV) {
    console.info('[study-tools-usage] reserved', {
      uidExists: Boolean(params.uid),
      tool: params.tool,
      sourceSurface: params.sourceSurface,
      used: daily.used,
      limit: daily.limit,
    });
  }

  return { allowed: true, daily, userPlan: plan };
}

/** Roll back a reserved generation when AI fails (same requestId + day only). */
export async function releaseStudyToolGeneration(params: {
  uid: string;
  tool: StudyToolKind;
  sourceSurface: StudyToolSourceSurface;
  requestId?: string | null;
}): Promise<void> {
  if (!readFirebaseAdminStatus().configured || !params.requestId?.trim()) return;

  const createdAt = isoNow();
  const dateKey = studyToolsDateKey(createdAt);
  const db = getFirebaseAdminDb();
  const usageRef = db.doc(`users/${params.uid}/usage/${dateKey}`);
  const summaryRef = db.doc(`users/${params.uid}/usageSummary/studyTools`);
  const requestRef = db.doc(`users/${params.uid}/usageRequests/${params.requestId.trim()}`);
  const toolField = counterFieldForTool(params.tool);
  const summaryField = summaryCounterForTool(params.tool, params.sourceSurface);

  await db.runTransaction(async (transaction) => {
    const [usageSnap, requestSnap] = await Promise.all([
      transaction.get(usageRef),
      transaction.get(requestRef),
    ]);
    const requestData = (requestSnap.data() ?? {}) as Record<string, unknown>;
    if (requestData.studyToolCountedDateKey !== dateKey) return;

    const usageData = (usageSnap.data() ?? {}) as Record<string, unknown>;
    const used = typeof usageData.studyToolGenerationsUsed === 'number' ? usageData.studyToolGenerationsUsed : 0;
    if (used <= 0) return;

    transaction.set(
      usageRef,
      {
        studyToolGenerationsUsed: FieldValue.increment(-1),
        [toolField]: FieldValue.increment(-1),
        updatedAt: createdAt,
        serverTimestamp: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    transaction.set(
      summaryRef,
      {
        [summaryField]: FieldValue.increment(-1),
        updatedAt: createdAt,
        serverTimestamp: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    transaction.set(
      requestRef,
      {
        studyToolCountedDateKey: FieldValue.delete(),
        updatedAt: createdAt,
        serverTimestamp: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

  if (IS_DEV) {
    console.info('[study-tools-usage] released failed generation', {
      uidExists: Boolean(params.uid),
      tool: params.tool,
      sourceSurface: params.sourceSurface,
    });
  }
}
