import { NextResponse } from 'next/server';

import { BUG_REPORT_MAX_SCREENSHOT_BYTES } from '@/lib/bug-report-types';
import { attachBugReportScreenshot } from '@/lib/bug-report-server';
import { readFirebaseAdminStatus } from '@/lib/firebase-admin';
import { requireFirebaseAuth } from '@/lib/firebase-server-auth';

export const runtime = 'nodejs';

export async function PATCH(
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

  let body: {
    screenshotUrl?: string;
    screenshotStoragePath?: string;
    screenshotOriginalName?: string;
    screenshotSizeBytes?: number;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const screenshotUrl = typeof body.screenshotUrl === 'string' ? body.screenshotUrl.trim() : '';
  const screenshotStoragePath =
    typeof body.screenshotStoragePath === 'string' ? body.screenshotStoragePath.trim() : '';
  const screenshotOriginalName =
    typeof body.screenshotOriginalName === 'string' ? body.screenshotOriginalName.trim() : '';
  const screenshotSizeBytes =
    typeof body.screenshotSizeBytes === 'number' ? body.screenshotSizeBytes : NaN;

  if (!screenshotUrl || !screenshotStoragePath || !screenshotOriginalName) {
    return NextResponse.json({ error: 'Screenshot metadata is incomplete.' }, { status: 400 });
  }
  if (!Number.isFinite(screenshotSizeBytes) || screenshotSizeBytes <= 0) {
    return NextResponse.json({ error: 'Invalid screenshot size.' }, { status: 400 });
  }
  if (screenshotSizeBytes > BUG_REPORT_MAX_SCREENSHOT_BYTES) {
    return NextResponse.json({ error: 'Screenshot exceeds the 5 MB limit.' }, { status: 400 });
  }

  try {
    const report = await attachBugReportScreenshot({
      reportId: normalizedReportId,
      uid: viewer.uid,
      screenshot: {
        screenshotUrl,
        screenshotStoragePath,
        screenshotOriginalName,
        screenshotSizeBytes,
      },
    });

    return NextResponse.json({ ok: true, report });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not attach screenshot.';
    const status = message.includes('Not allowed') ? 403 : message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
