'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProfileRoutePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/app/settings');
  }, [router]);

  return (
    <div className="text-sm text-text-secondary">
      Redirecting to Settings...
    </div>
  );
}
