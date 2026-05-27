import { NextResponse } from 'next/server';

import { assertAdminApiRequest } from '@/lib/admin-auth';
import {
  BUG_REPORT_PRIORITIES,
  BUG_REPORT_STATUSES,
  type BugReportPriority,
  type BugReportStatus,
} from '@/lib/bug-report-types';
import { updateBugReportAsAdmin } from '@/lib/bug-report-server';
import { AdminConfigError } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ reportId: string }> },
) {
  const admin = await assertAdminApiRequest(request);
  if (admin instanceof NextResponse) return admin;

  const { reportId } = await context.params;
  const normalizedReportId = reportId.trim();
  if (!normalizedReportId) {
    return NextResponse.json({ error: 'Missing report ID.' }, { status: 400 });
  }

  let body: {
    status?: string;
    priority?: string;
    adminNotes?: string | null;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const status =
    body.status === undefined
      ? undefined
      : BUG_REPORT_STATUSES.includes(body.status as BugReportStatus)
        ? (body.status as BugReportStatus)
        : null;
  const priority =
    body.priority === undefined
      ? undefined
      : BUG_REPORT_PRIORITIES.includes(body.priority as BugReportPriority)
        ? (body.priority as BugReportPriority)
        : null;

  if (body.status !== undefined && !status) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
  }
  if (body.priority !== undefined && !priority) {
    return NextResponse.json({ error: 'Invalid priority.' }, { status: 400 });
  }

  const adminNotes =
    body.adminNotes === undefined
      ? undefined
      : body.adminNotes === null
        ? null
        : typeof body.adminNotes === 'string'
          ? body.adminNotes
          : null;

  if (body.adminNotes !== undefined && body.adminNotes !== null && typeof body.adminNotes !== 'string') {
    return NextResponse.json({ error: 'Invalid admin notes.' }, { status: 400 });
  }

  try {
    const report = await updateBugReportAsAdmin({
      reportId: normalizedReportId,
      actorUid: admin.uid,
      actorEmail: admin.email,
      input: {
        status: status ?? undefined,
        priority: priority ?? undefined,
        adminNotes,
      },
    });

    return NextResponse.json({ ok: true, report });
  } catch (error) {
    if (error instanceof AdminConfigError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const message = error instanceof Error ? error.message : 'Could not update bug report.';
    const statusCode = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
