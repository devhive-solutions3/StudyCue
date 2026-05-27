'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';

import { getFirebaseDb, useWebAuth } from '@/lib/firebase-client';
import { canUseStudyTools, getUserPlan } from '@/lib/plan-access';

export function usePremiumStudyTools() {
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
        setAllowed(canUseStudyTools(profile));
        const plan = getUserPlan(profile);
        setPlanLabel(plan === 'beta' ? 'Beta' : plan === 'premium' ? 'StudyCue Plus' : 'Free');
      },
      () => {
        setProfileUid(user.uid);
        setAllowed(false);
        setPlanLabel('Free');
      },
    );
  }, [user]);

  const profileResolved = Boolean(user && profileUid === user.uid);
  const studyToolsAllowed = profileResolved && allowed;
  const loading = !ready || (Boolean(user) && !profileResolved);

  return { user, ready, loading, allowed: studyToolsAllowed, planLabel };
}
