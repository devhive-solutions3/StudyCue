'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';

import { getFirebaseDb, useWebAuth } from '@/lib/firebase-client';
import { canUsePremiumStudyTools } from '@/lib/plan-access';
import { getUserPlan } from '@/lib/plan-access';

export default function PremiumStudyToolGate({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const { user, ready } = useWebAuth();
  const [allowed, setAllowed] = useState(false);
  const [planLabel, setPlanLabel] = useState('Free');
  const [profileUid, setProfileUid] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();
    return onSnapshot(
      doc(db, 'users', user.uid),
      (snapshot) => {
        const profile = snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : null;
        setProfileUid(user.uid);
        setAllowed(canUsePremiumStudyTools(profile));
        const plan = getUserPlan(profile);
        setPlanLabel(plan === 'beta' ? 'Beta' : plan === 'premium' ? 'StudyCue Plus' : 'Free');
      },
      () => {
        setProfileUid(user.uid);
        setAllowed(false);
      },
    );
  }, [user]);

  const profileResolved = Boolean(user && profileUid === user.uid);

  if (!ready || (user && !profileResolved)) {
    return <div className="py-10 text-sm text-text-secondary">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="rounded-[16px] border border-border bg-surface-2 p-6">
        <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
        <p className="mt-2 text-sm text-text-secondary">Sign in to use study tools.</p>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.35em] text-text-muted">Study tools</p>
          <h1 className="mt-1 text-3xl font-semibold text-text-primary">{title}</h1>
          <p className="mt-2 text-sm text-text-secondary">{subtitle}</p>
        </div>
        <div className="rounded-[16px] border border-dashed border-border bg-surface-2 px-6 py-10 text-center">
          <p className="text-sm font-semibold text-text-primary">Available in Beta / StudyCue Plus</p>
          <p className="mt-2 text-sm text-text-secondary">
            This study tool is available for Beta and StudyCue Plus users. Your current plan:{' '}
            <span className="font-semibold text-text-primary">{planLabel}</span>.
          </p>
          <p className="mt-3 text-xs text-text-muted">Coming Soon for Free</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
