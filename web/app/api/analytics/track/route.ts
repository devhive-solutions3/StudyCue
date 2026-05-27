import { NextResponse } from 'next/server';

import {
  isAllowedAnalyticsEventType,
  isAllowedAnalyticsFeature,
  sanitizeAnalyticsMetadata,
} from '@/lib/analytics-metadata';
import { featureFromAppPathname, routeFromAppPathname } from '@/lib/analytics-route-map';
import {
  logAnalyticsEvent,
  markUserActive,
  planFromProfile,
} from '@/lib/analytics-tracker';
import { requireFirebaseAuth } from '@/lib/firebase-server-auth';
import { getFirebaseAdminDb, readFirebaseAdminStatus } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const viewer = await requireFirebaseAuth(request);
  if (!viewer) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!readFirebaseAdminStatus().configured) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const eventType = typeof body.eventType === 'string' ? body.eventType : '';
  const featureInput = typeof body.feature === 'string' ? body.feature : '';
  const routeInput = typeof body.route === 'string' ? body.route : null;

  if (!isAllowedAnalyticsEventType(eventType)) {
    return NextResponse.json({ error: 'Invalid eventType.' }, { status: 400 });
  }

  const route = routeInput ?? routeFromAppPathname(routeInput);
  const feature = isAllowedAnalyticsFeature(featureInput)
    ? featureInput
    : featureFromAppPathname(route ?? routeInput);

  if (!feature) {
    return NextResponse.json({ error: 'Invalid feature.' }, { status: 400 });
  }

  const metadata =
    body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
      ? sanitizeAnalyticsMetadata(body.metadata as Record<string, unknown>)
      : {};

  const db = getFirebaseAdminDb();
  const profileSnap = await db.doc(`users/${viewer.uid}`).get();
  const profile = profileSnap.exists ? (profileSnap.data() as Record<string, unknown>) : null;
  const userPlan = planFromProfile(profile);

  await logAnalyticsEvent({
    uid: viewer.uid,
    userPlan,
    eventType,
    feature,
    route,
    metadata,
  });

  const shouldMarkActive =
    eventType === 'page_view' ||
    eventType === 'feature_open' ||
    eventType === 'login' ||
    eventType === 'note_upload' ||
    eventType === 'bug_report_submit';

  if (shouldMarkActive) {
    await markUserActive({
      uid: viewer.uid,
      userPlan,
      feature,
      route,
      eventType,
      metadata,
      incrementPageView: eventType === 'page_view' || eventType === 'feature_open',
      recordLogin: eventType === 'login',
    });
  }

  return NextResponse.json({ ok: true });
}
