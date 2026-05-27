import 'server-only';

import { isoNow, monthKeyFromIso } from '@/lib/admin-log';
import { studyToolsDateKey } from '@/lib/study-tools-time';
import { weekKeyFromIso } from '@/lib/analytics-tracker';
import type { AnalyticsFeature, AnalyticsUserPlan } from '@/lib/analytics-types';
import { getFirebaseAdminDb, readFirebaseAdminStatus } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { StudyToolKind, StudyToolSourceSurface } from '@/lib/study-tools-usage-limits';
import type { StudySourceType } from '@/lib/study-tools-types';

export type StudyToolGenerationStatus = 'success' | 'error' | 'rate_limited' | 'denied';

export async function logStudyToolGenerationEvent(params: {
  uid: string;
  userPlan: AnalyticsUserPlan;
  tool: StudyToolKind;
  sourceSurface: StudyToolSourceSurface;
  sourceType: StudySourceType | 'cue_attachment';
  itemCount: number;
  status: StudyToolGenerationStatus;
  endpoint: string;
}): Promise<void> {
  if (!readFirebaseAdminStatus().configured) return;

  const createdAt = isoNow();
  const dateKey = studyToolsDateKey(createdAt);
  const feature: AnalyticsFeature =
    params.tool === 'quiz' ? 'quiz_generator' : params.tool === 'flashcards' ? 'flashcards' : 'file_study';

  const db = getFirebaseAdminDb();
  const eventRef = db.collection('analyticsEvents').doc();
  const studyRef = db.collection('studyToolEvents').doc();

  const payload = {
    eventId: eventRef.id,
    eventType: 'study_tool_generation',
    feature,
    toolType: params.tool,
    uid: params.uid,
    userPlan: params.userPlan,
    sourceSurface: params.sourceSurface,
    sourceType: params.sourceType,
    itemCount: params.itemCount,
    status: params.status,
    endpoint: params.endpoint,
    route: null,
    dateKey,
    weekKey: weekKeyFromIso(createdAt),
    monthKey: monthKeyFromIso(createdAt),
    createdAt,
    metadata: {
      toolType: params.tool,
      sourceSurface: params.sourceSurface,
      sourceType: params.sourceType,
      itemCount: params.itemCount,
      status: params.status,
      endpoint: params.endpoint,
    },
    serverTimestamp: FieldValue.serverTimestamp(),
  };

  await Promise.all([eventRef.set(payload), studyRef.set({ ...payload, eventId: studyRef.id })]);

  const dailyRef = db.doc(`adminMetrics/studyTools/daily/${dateKey}`);
  const inc: Record<string, unknown> = {
    dateKey,
    updatedAt: createdAt,
    generations: FieldValue.increment(1),
    serverTimestamp: FieldValue.serverTimestamp(),
  };

  if (params.status === 'success') {
    if (params.tool === 'quiz') inc.quizGenerations = FieldValue.increment(1);
    if (params.tool === 'flashcards') inc.flashcardGenerations = FieldValue.increment(1);
    if (params.tool === 'file_study') inc.fileStudyGenerations = FieldValue.increment(1);
    if (params.sourceSurface === 'cue_ai') {
      if (params.tool === 'quiz') inc.cueQuizGenerations = FieldValue.increment(1);
      if (params.tool === 'flashcards') inc.cueFlashcardGenerations = FieldValue.increment(1);
    }
    inc[`${params.userPlan}Generations`] = FieldValue.increment(1);
  }
  if (params.status === 'rate_limited') inc.rateLimited = FieldValue.increment(1);
  if (params.status === 'denied') inc.denied = FieldValue.increment(1);

  await dailyRef.set(inc, { merge: true });
}
