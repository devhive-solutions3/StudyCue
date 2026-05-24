import { getAdsenseClient } from '@/lib/adsense-config';

export default function Head() {
  const adsenseClient = getAdsenseClient();

  return (
    <>
      <script
        async
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adsenseClient)}`}
        crossOrigin="anonymous"
      />
    </>
  );
}
