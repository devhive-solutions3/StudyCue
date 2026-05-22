'use client';

import clsx from 'clsx';
import { useEffect, useState } from 'react';

type Props = {
  compact?: boolean;
  className?: string;
};

const AD_CONSENT_KEY = 'studycue.ads_consent';

/** AdSense unit; consent-gated unless NEXT_PUBLIC_SKIP_AD_CONSENT=1. */
export default function AdSenseSlot({ compact, className }: Props) {
  const client =
    typeof process.env.NEXT_PUBLIC_ADSENSE_CLIENT === 'string'
      ? process.env.NEXT_PUBLIC_ADSENSE_CLIENT.trim()
      : '';
  const slot =
    typeof process.env.NEXT_PUBLIC_ADSENSE_SLOT_INLINE === 'string'
      ? process.env.NEXT_PUBLIC_ADSENSE_SLOT_INLINE.trim()
      : '';

  const skipConsent = process.env.NEXT_PUBLIC_SKIP_AD_CONSENT === '1';
  const qa = process.env.NEXT_PUBLIC_SHOW_ADS === '1';

  const [allowed, setAllowed] = useState(() => skipConsent);

  useEffect(() => {
    function read() {
      if (skipConsent) {
        setAllowed(true);
        return;
      }
      setAllowed(localStorage.getItem(AD_CONSENT_KEY) === 'granted');
    }
    read();
    window.addEventListener('studycue-consent-changed', read);
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener('studycue-consent-changed', read);
      window.removeEventListener('storage', read);
    };
  }, [skipConsent]);

  useEffect(() => {
    if (!allowed || !client || !slot) return;
    try {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      (window as any).adsbygoogle = (window as any).adsbygoogle || [];
      (window as any).adsbygoogle.push({});
    } catch {
      /* ignore offline / blocked trackers */
    }
  }, [allowed, client, slot]);

  if (!client || !slot || !allowed) return null;

  return (
    <div
      className={clsx(
        'ad-slot mx-auto my-6 rounded-xl border border-dashed border-slate-700/70 bg-slate-900/50 p-2 text-center text-xs text-white/35',
        compact ? 'min-h-[110px]' : 'min-h-[220px]',
        className,
      )}
      suppressHydrationWarning
    >
      <ins
        className="adsbygoogle mx-auto block w-full bg-transparent"
        style={{ display: 'block', minHeight: compact ? 100 : 200 }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
        {...(qa ? ({ 'data-adtest': 'on' } as object) : {})}
      />
    </div>
  );
}
