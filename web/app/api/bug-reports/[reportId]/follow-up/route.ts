import { NextResponse } from 'next/server';

import { addBugReportFollowUp } from '@/lib/bug-report-server';
import { readFirebaseAdminStatus } from '@/lib/firebase-admin';
import { requireFirebaseAuth } from '@/lib/firebase-server-auth';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  context: { params: Promise<{ reportId: string }> },
) {
  const viewer = await requireFirebaseAuth(request);
  if (!viewer) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  if (!readFirebaseAdminStatus().configured) {
    return NextResponse.json({ error: 'Server storage is not configured.' }, { status: 500 });
  }

  const { reportId } = await context.params;
  const normalizedReportId = reportId.trim();
  if (!normalizedReportId) {
    return NextResponse.json({ error: 'Missing report ID.' }, { status: 400 });
  }

  let body: { message?: string };
  try {
    body = (await request.json()) as { message?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const message = typeof body.message === 'string' ? body.message : '';

  try {
    const report = await addBugReportFollowUp({
      reportId: normalizedReportId,
      uid: viewer.uid,
      message,
    });
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    const text = error instanceof Error ? error.message : 'Could not add follow-up.';
    const status = text.includes('Not allowed')
      ? 403
      : text.includes('not found')
        ? 404
        : text.includes('only available')
          ? 400
          : 500;
    return NextResponse.json({ error: text }, { status });
  }
}
