import { NextResponse } from 'next/server';

import { assertAdminApiRequest } from '@/lib/admin-auth';

const sections = [
  'Overview',
  'Users',
  'AI Usage',
  'Blogs',
  'Revenue',
  'Security Logs',
];

export async function GET(request: Request) {
  const admin = await assertAdminApiRequest(request);
  if (admin instanceof NextResponse) return admin;

  return NextResponse.json({
    ok: true,
    admin: {
      uid: admin.uid,
      email: admin.email,
    },
    sections,
  });
}
