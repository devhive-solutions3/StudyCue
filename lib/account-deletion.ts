/**
 * Deletes the signed-in Firebase Auth user after re-auth + clears local SQLite + Firestore mirror.
 * Email/password accounts only — Google-only users must reset via Firebase Console or Web.
 */

import {
  EmailAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
} from '@firebase/auth';

import { auth } from './firebase';
import { deleteMirror } from './sync';

export async function reauthenticateThenDeleteFirebaseUser(password: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('No signed-in user with email/password.');
  const cred = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, cred);

  const uid = user.uid;
  await deleteMirror(user);
  await wipeLocalSQLiteForFirebaseUid(uid);
  await deleteUser(user);
}

export async function wipeLocalSQLiteForFirebaseUid(firebaseUid: string): Promise<void> {
  const { initDatabase } = await import('./db');
  const sql = await initDatabase();
  const row = await sql.getFirstAsync<{ id: number }>(
    'SELECT id FROM users_local WHERE firebaseUserId = ?',
    [firebaseUid],
  );
  if (!row) return;

  const userId = row.id;
  await sql.runAsync('DELETE FROM study_sessions WHERE userId = ?', [userId]);
  await sql.runAsync('DELETE FROM tasks WHERE userId = ?', [userId]);
  await sql.runAsync('DELETE FROM classes WHERE userId = ?', [userId]);
  await sql.runAsync('DELETE FROM task_categories WHERE userId = ?', [userId]);
  await sql.runAsync('DELETE FROM ai_preferences WHERE userId = ?', [userId]);
  await sql.runAsync('DELETE FROM users_local WHERE id = ?', [userId]);
}
