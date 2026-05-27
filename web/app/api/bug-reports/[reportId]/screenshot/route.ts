import { NextResponse } from 'next/server';

import {
  attachBugReportScreenshot,
  uploadBugReportScreenshotServer,
} from '@/lib/bug-report-server';
import { BUG_REPORT_MAX_SCREENSHOT_BYTES, BUG_REPORT_SCREENSHOT_TYPES } from '@/lib/bug-report-types';
import { AdminConfigError, readFirebaseAdminStatus } from '@/lib/firebase-admin';
import { requireFirebaseAuth } from '@/lib/firebase-server-auth';

export const runtime = 'nodejs';

const ALLOWED_TYPES = new Set<string>(BUG_REPORT_SCREENSHOT_TYPES);

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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Screenshot file is required.' }, { status: 400 });
  }

  const contentType =
    typeof formData.get('contentType') === 'string' && formData.get('contentType')
      ? String(formData.get('contentType'))
      : file.type || 'image/jpeg';

  if (!ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json({ error: 'Screenshot must be PNG, JPEG, or WebP.' }, { status: 400 });
  }

  if (file.size > BUG_REPORT_MAX_SCREENSHOT_BYTES) {
    return NextResponse.json({ error: 'Screenshot exceeds the 5 MB limit.' }, { status: 400 });
  }

  const originalName =
    typeof formData.get('originalName') === 'string' && formData.get('originalName')
      ? String(formData.get('originalName'))
      : file.name || 'screenshot.jpg';

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadBugReportScreenshotServer({
      uid: viewer.uid,
      reportId: normalizedReportId,
      buffer,
      contentType,
      originalName,
    });

    const report = await attachBugReportScreenshot({
      reportId: normalizedReportId,
      uid: viewer.uid,
      screenshot: uploaded,
    });

    return NextResponse.json({ ok: true, report });
  } catch (error) {
    if (error instanceof AdminConfigError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const message = error instanceof Error ? error.message : 'Could not upload screenshot.';
    const status = message.includes('Not allowed')
      ? 403
      : message.includes('not found')
        ? 404
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
