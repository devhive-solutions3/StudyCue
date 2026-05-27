import 'server-only';

import { isoNow } from '@/lib/admin-log';
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
  savedQuizzes: number;
  savedFlashcardDecks: number;
  storageUsedBytes: number;
  storageLimitBytes: number;
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
    savedQuizzesTotal: number;
    savedFlashcardDecksTotal: number;
  };
  storageNote: string;
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
      savedQuizzesTotal: 0,
      savedFlashcardDecksTotal: 0,
    },
    storageNote:
      'Saved quizzes and flashcard decks are stored in Firestore under each user. They share the plan notes/file storage quota (Beta 1 GB, Premium 5 GB).',
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
  const todayManila = studyToolsDateKey(isoNow());

  const [dailyMetrics, eventsSnap, savedQuizzesCount, savedDecksCount, emailByUid] = await Promise.all([
    db.doc(`adminMetrics/studyTools/daily/${todayManila}`).get(),
    db
      .collection('studyToolEvents')
      .orderBy('createdAt', 'desc')
      .limit(250)
      .get()
      .catch(() => null),
    db.collectionGroup('quizzes').count().get().catch(() => null),
    db.collectionGroup('flashcardDecks').count().get().catch(() => null),
    new Map<string, string | null>(),
  ]);

  const metrics = (dailyMetrics.data() ?? {}) as Record<string, unknown>;

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

  const isTodayManila = (createdAt: string) =>
    createdAt ? studyToolsDateKey(createdAt) === todayManila : false;

  const todayEvents = events.filter((e) => e.status === 'success' && isTodayManila(e.createdAt));
  const todayAllStatus = events.filter((e) => isTodayManila(e.createdAt));

  const summary = {
    quizGenerationsToday: todayEvents.filter((e) => e.toolType === 'quiz').length,
    flashcardGenerationsToday: todayEvents.filter((e) => e.toolType === 'flashcards').length,
    fileStudyGenerationsToday: todayEvents.filter((e) => e.toolType === 'file_study').length,
    cueQuizGenerationsToday: todayEvents.filter(
      (e) => e.toolType === 'quiz' && e.sourceSurface === 'cue_ai',
    ).length,
    cueFlashcardGenerationsToday: todayEvents.filter(
      (e) => e.toolType === 'flashcards' && e.sourceSurface === 'cue_ai',
    ).length,
    rateLimitedToday: todayAllStatus.filter((e) => e.status === 'rate_limited').length,
    activeBetaUsers: 0,
    activePremiumUsers: 0,
    savedQuizzesTotal: savedQuizzesCount?.data().count ?? 0,
    savedFlashcardDecksTotal: savedDecksCount?.data().count ?? 0,
  };

  // Prefer event-derived totals; fall back to metrics doc if events are empty (older data).
  if (todayEvents.length === 0) {
    summary.quizGenerationsToday = readNumber(metrics.quizGenerations);
    summary.flashcardGenerationsToday = readNumber(metrics.flashcardGenerations);
    summary.fileStudyGenerationsToday = readNumber(metrics.fileStudyGenerations);
    summary.cueQuizGenerationsToday = readNumber(metrics.cueQuizGenerations);
    summary.cueFlashcardGenerationsToday = readNumber(metrics.cueFlashcardGenerations);
    summary.rateLimitedToday = readNumber(metrics.rateLimited);
  }
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

  const profileByUid = new Map<
    string,
    { email: string | null; storageUsedBytes: number; storageLimitBytes: number }
  >();

  await Promise.all(
    topUids.map(async (uid) => {
      try {
        const profile = await db.doc(`users/${uid}`).get();
        const data = profile.data() ?? {};
        const email = typeof data.email === 'string' ? data.email : null;
        emailByUid.set(uid, email);
        profileByUid.set(uid, {
          email,
          storageUsedBytes: readNumber(data.storageUsedBytes),
          storageLimitBytes: readNumber(data.storageLimitBytes),
        });
      } catch {
        emailByUid.set(uid, null);
        profileByUid.set(uid, { email: null, storageUsedBytes: 0, storageLimitBytes: 0 });
      }
    }),
  );

  const savedCounts = await Promise.all(
    topUids.map(async (uid) => {
      try {
        const [quizzes, decks] = await Promise.all([
          db.collection(`users/${uid}/quizzes`).count().get(),
          db.collection(`users/${uid}/flashcardDecks`).count().get(),
        ]);
        return {
          quizzes: quizzes.data().count,
          decks: decks.data().count,
        };
      } catch {
        return { quizzes: 0, decks: 0 };
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
      savedQuizzes: savedCounts[index]?.quizzes ?? 0,
      savedFlashcardDecks: savedCounts[index]?.decks ?? 0,
      storageUsedBytes: profileByUid.get(uid)?.storageUsedBytes ?? 0,
      storageLimitBytes: profileByUid.get(uid)?.storageLimitBytes ?? 0,
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

  return {
    summary,
    byPlan,
    topUsers,
    recentEvents,
    storageNote:
      'Saved quizzes and flashcard decks live in Firestore (users/{uid}/quizzes and flashcardDecks). They count toward the same plan storage quota as Notes files (Beta 1 GB, Premium 5 GB, Free 100 MB).',
  };
}
