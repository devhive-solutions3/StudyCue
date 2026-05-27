import 'server-only';

import { dateKeyFromIso, isoNow } from '@/lib/admin-log';
import { getFirebaseAdminDb, readFirebaseAdminStatus } from '@/lib/firebase-admin';
import { studyToolsDateKey } from '@/lib/study-tools-time';

export type StudyToolEventRow = {
  eventId: string;
  createdAt: string;
  uid: string;
  userEmail: string | null;
  userPlan: string;
  toolType: string;
  sourceSurface: string;
  itemCount: number;
  status: string;
  endpoint: string;
};

export type StudyToolsTopUserRow = {
  uid: string;
  email: string | null;
  plan: string;
  quizToday: number;
  flashcardsToday: number;
  fileStudyToday: number;
  studyToolsUsed: number;
  studyToolLimit: number;
  resetLabel: string;
  lastGeneratedAt: string | null;
  fromPages: number;
  fromCue: number;
};

export type StudyToolsAdminDashboard = {
  summary: {
    quizGenerationsToday: number;
    flashcardGenerationsToday: number;
    fileStudyGenerationsToday: number;
    cueQuizGenerationsToday: number;
    cueFlashcardGenerationsToday: number;
    rateLimitedToday: number;
    activeBetaUsers: number;
    activePremiumUsers: number;
  };
  byPlan: {
    betaQuiz: number;
    betaFlashcards: number;
    premiumQuiz: number;
    premiumFlashcards: number;
  };
  topUsers: StudyToolsTopUserRow[];
  recentEvents: StudyToolEventRow[];
};

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export async function readStudyToolsAdminDashboard(): Promise<StudyToolsAdminDashboard> {
  const empty: StudyToolsAdminDashboard = {
    summary: {
      quizGenerationsToday: 0,
      flashcardGenerationsToday: 0,
      fileStudyGenerationsToday: 0,
      cueQuizGenerationsToday: 0,
      cueFlashcardGenerationsToday: 0,
      rateLimitedToday: 0,
      activeBetaUsers: 0,
      activePremiumUsers: 0,
    },
    byPlan: {
      betaQuiz: 0,
      betaFlashcards: 0,
      premiumQuiz: 0,
      premiumFlashcards: 0,
    },
    topUsers: [],
    recentEvents: [],
  };

  if (!readFirebaseAdminStatus().configured) return empty;

  const db = getFirebaseAdminDb();
  const todayUtc = dateKeyFromIso(isoNow());
  const todayManila = studyToolsDateKey();

  const [dailyMetrics, eventsSnap, emailByUid] = await Promise.all([
    db.doc(`adminMetrics/studyTools/daily/${todayUtc}`).get(),
    db
      .collection('studyToolEvents')
      .orderBy('createdAt', 'desc')
      .limit(250)
      .get()
      .catch(() => null),
    new Map<string, string | null>(),
  ]);

  const metrics = (dailyMetrics.data() ?? {}) as Record<string, unknown>;
  const summary = {
    quizGenerationsToday: readNumber(metrics.quizGenerations),
    flashcardGenerationsToday: readNumber(metrics.flashcardGenerations),
    fileStudyGenerationsToday: readNumber(metrics.fileStudyGenerations),
    cueQuizGenerationsToday: readNumber(metrics.cueQuizGenerations),
    cueFlashcardGenerationsToday: readNumber(metrics.cueFlashcardGenerations),
    rateLimitedToday: readNumber(metrics.rateLimited),
    activeBetaUsers: 0,
    activePremiumUsers: 0,
  };

  const events =
    eventsSnap?.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      return {
        eventId: doc.id,
        createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
        uid: typeof data.uid === 'string' ? data.uid : '',
        userEmail: null,
        userPlan: typeof data.userPlan === 'string' ? data.userPlan : 'free',
        toolType: typeof data.toolType === 'string' ? data.toolType : '',
        sourceSurface: typeof data.sourceSurface === 'string' ? data.sourceSurface : '',
        itemCount: readNumber(data.itemCount),
        status: typeof data.status === 'string' ? data.status : '',
        endpoint: typeof data.endpoint === 'string' ? data.endpoint : '',
        dateKey: typeof data.dateKey === 'string' ? data.dateKey : '',
      };
    }) ?? [];

  const todayEvents = events.filter((e) => e.dateKey === todayUtc && e.status === 'success');
  const betaUsers = new Set<string>();
  const premiumUsers = new Set<string>();

  const byPlan = {
    betaQuiz: 0,
    betaFlashcards: 0,
    premiumQuiz: 0,
    premiumFlashcards: 0,
  };

  for (const event of todayEvents) {
    if (event.userPlan === 'beta') {
      betaUsers.add(event.uid);
      if (event.toolType === 'quiz') byPlan.betaQuiz += 1;
      if (event.toolType === 'flashcards') byPlan.betaFlashcards += 1;
    }
    if (event.userPlan === 'premium') {
      premiumUsers.add(event.uid);
      if (event.toolType === 'quiz') byPlan.premiumQuiz += 1;
      if (event.toolType === 'flashcards') byPlan.premiumFlashcards += 1;
    }
  }

  summary.activeBetaUsers = betaUsers.size;
  summary.activePremiumUsers = premiumUsers.size;

  const userAgg = new Map<
    string,
    {
      plan: string;
      quiz: number;
      flashcards: number;
      fileStudy: number;
      fromPages: number;
      fromCue: number;
      lastAt: string | null;
    }
  >();

  for (const event of todayEvents) {
    if (!event.uid) continue;
    const row =
      userAgg.get(event.uid) ??
      ({
        plan: event.userPlan,
        quiz: 0,
        flashcards: 0,
        fileStudy: 0,
        fromPages: 0,
        fromCue: 0,
        lastAt: null,
      } satisfies (typeof userAgg extends Map<string, infer V> ? V : never));

    if (event.toolType === 'quiz') row.quiz += 1;
    if (event.toolType === 'flashcards') row.flashcards += 1;
    if (event.toolType === 'file_study') row.fileStudy += 1;
    if (event.sourceSurface === 'cue_ai') row.fromCue += 1;
    else row.fromPages += 1;
    if (!row.lastAt || event.createdAt > row.lastAt) row.lastAt = event.createdAt;
    userAgg.set(event.uid, row);
  }

  const topUids = [...userAgg.entries()]
    .sort((a, b) => b[1].quiz + b[1].flashcards + b[1].fileStudy - (a[1].quiz + a[1].flashcards + a[1].fileStudy))
    .slice(0, 25)
    .map(([uid]) => uid);

  await Promise.all(
    topUids.map(async (uid) => {
      try {
        const profile = await db.doc(`users/${uid}`).get();
        const email = profile.data()?.email;
        emailByUid.set(uid, typeof email === 'string' ? email : null);
      } catch {
        emailByUid.set(uid, null);
      }
    }),
  );

  const usageSnaps = await Promise.all(
    topUids.map((uid) => db.doc(`users/${uid}/usage/${todayManila}`).get()),
  );

  const topUsers: StudyToolsTopUserRow[] = topUids.map((uid, index) => {
    const agg = userAgg.get(uid)!;
    const usage = (usageSnaps[index]?.data() ?? {}) as Record<string, unknown>;
    const used = readNumber(usage.studyToolGenerationsUsed);
    const limit = readNumber(usage.studyToolDailyLimit);
    const resetAt = typeof usage.studyToolsResetAt === 'string' ? usage.studyToolsResetAt : '';
    return {
      uid,
      email: emailByUid.get(uid) ?? null,
      plan: agg.plan,
      quizToday: agg.quiz,
      flashcardsToday: agg.flashcards,
      fileStudyToday: agg.fileStudy,
      studyToolsUsed: used || agg.quiz + agg.flashcards + agg.fileStudy,
      studyToolLimit: limit,
      resetLabel: resetAt ? new Date(resetAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' }) : '12:00 AM',
      lastGeneratedAt: agg.lastAt,
      fromPages: agg.fromPages,
      fromCue: agg.fromCue,
    };
  });

  const recentEvents: StudyToolEventRow[] = events.slice(0, 80).map((event) => ({
    eventId: event.eventId,
    createdAt: event.createdAt,
    uid: event.uid,
    userEmail: emailByUid.get(event.uid) ?? null,
    userPlan: event.userPlan,
    toolType: event.toolType,
    sourceSurface: event.sourceSurface,
    itemCount: event.itemCount,
    status: event.status,
    endpoint: event.endpoint,
  }));

  return { summary, byPlan, topUsers, recentEvents };
}
