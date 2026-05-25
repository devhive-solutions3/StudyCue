import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';

import { getFirebaseAdminDb } from '@/lib/firebase-admin';

export type AdminLogSeverity = 'info' | 'warning' | 'error' | 'critical';

export function isoNow(): string {
  return new Date().toISOString();
}

export function dateKeyFromIso(iso: string): string {
  return iso.slice(0, 10);
}

export function monthKeyFromIso(iso: string): string {
  return iso.slice(0, 7);
}

function cleanObject(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  );
}

export async function writeAdminAuditLog(params: {
  actorUid: string;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  severity?: AdminLogSeverity;
}) {
  const createdAt = isoNow();
  const db = getFirebaseAdminDb();
  await db.collection('adminAuditLogs').add(
    cleanObject({
      actorUid: params.actorUid,
      actorEmail: params.actorEmail ?? null,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      metadata: params.metadata ?? {},
      severity: params.severity ?? 'info',
      createdAt,
      dateKey: dateKeyFromIso(createdAt),
      serverTimestamp: FieldValue.serverTimestamp(),
    }),
  );
}

export async function writeSecurityLog(params: {
  severity?: AdminLogSeverity;
  actorUid?: string | null;
  actorEmail?: string | null;
  action: string;
  target?: string | null;
  details?: Record<string, unknown>;
  category?: string;
}) {
  const createdAt = isoNow();
  const db = getFirebaseAdminDb();
  await db.collection('securityLogs').add(
    cleanObject({
      severity: params.severity ?? 'warning',
      actorUid: params.actorUid ?? null,
      actorEmail: params.actorEmail ?? null,
      actor: params.actorEmail ?? params.actorUid ?? 'anonymous',
      action: params.action,
      target: params.target ?? null,
      details: params.details ?? {},
      category: params.category ?? 'general',
      createdAt,
      dateKey: dateKeyFromIso(createdAt),
      serverTimestamp: FieldValue.serverTimestamp(),
    }),
  );
}
