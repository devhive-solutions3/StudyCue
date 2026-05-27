import { NextResponse } from 'next/server';

import { AdminConfigError, readFirebaseAdminStatus } from '@/lib/firebase-admin';
import { requireFirebaseAuth } from '@/lib/firebase-server-auth';
import { createBugReport, listBugReportsForUser } from '@/lib/bug-report-server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const viewer = await requireFirebaseAuth(request);
  if (!viewer) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  if (!readFirebaseAdminStatus().configured) {
    return NextResponse.json({ reports: [] });
  }

  try {
    const reports = await listBugReportsForUser(viewer.uid);
    return NextResponse.json({ ok: true, reports });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load bug reports.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const viewer = await requireFirebaseAuth(request);
  if (!viewer) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  if (!readFirebaseAdminStatus().configured) {
    return NextResponse.json({ error: 'Server storage is not configured.' }, { status: 500 });
  }

  let body: {
    title?: string;
    description?: string;
    pageUrl?: string;
    browserInfo?: string;
    deviceInfo?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';

  if (!title) {
    return NextResponse.json({ error: 'Title is required.' }, { status: 400 });
  }
  if (title.length > 200) {
    return NextResponse.json({ error: 'Title must be 200 characters or fewer.' }, { status: 400 });
  }
  if (!description) {
    return NextResponse.json({ error: 'Description is required.' }, { status: 400 });
  }
  if (description.length > 8000) {
    return NextResponse.json({ error: 'Description must be 8000 characters or fewer.' }, { status: 400 });
  }

  try {
    const report = await createBugReport({
      uid: viewer.uid,
      email: viewer.email,
      displayName: viewer.name,
      input: {
        title,
        description,
        pageUrl: typeof body.pageUrl === 'string' ? body.pageUrl : null,
        browserInfo: typeof body.browserInfo === 'string' ? body.browserInfo : null,
        deviceInfo: typeof body.deviceInfo === 'string' ? body.deviceInfo : null,
      },
    });

    return NextResponse.json({
      ok: true,
      reportId: report.reportId,
      report,
    });
  } catch (error) {
    if (error instanceof AdminConfigError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const message = error instanceof Error ? error.message : 'Could not create bug report.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
