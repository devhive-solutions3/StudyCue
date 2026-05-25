import AdminUsersClient from '@/components/admin/AdminUsersClient';
import { readAdminDataSourceStatus, readAdminUsers } from '@/lib/admin-data';

export default async function AdminUsersPage() {
  const dataSource = readAdminDataSourceStatus();
  const usersResult = await readAdminUsers();
  const users = usersResult.users;

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-white/10 bg-white/5 px-6 py-5 backdrop-blur-xl dark:border-white/8 dark:bg-white/6">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">Admin / Users</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-text-primary">User directory</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Review Firebase Auth users, merge `users/{'{uid}'}` profile data, and update access plans safely.
        </p>
      </div>

      {!dataSource.configured ? (
        <div className="rounded-[24px] border border-amber-400/25 bg-amber-500/10 px-6 py-5 text-sm text-amber-100/90">
          Firebase Admin credentials are not configured. User data will stay empty until you add `FIREBASE_SERVICE_ACCOUNT_KEY` or `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`.
        </div>
      ) : null}

      {usersResult.warning ? (
        <div className="rounded-[24px] border border-amber-400/25 bg-amber-500/10 px-6 py-5 text-sm text-amber-100/90">
          {usersResult.warning}
        </div>
      ) : null}

      <AdminUsersClient users={users} />
    </div>
  );
}
