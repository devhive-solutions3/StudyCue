import Script from 'next/script';

/** Plausible; no consent needed for basic EU guidance when cookieless stats — still pair with banner for ads providers. */
export default function PrivacyAnalyticsScripts() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim();
  if (!domain) return null;

  const url =
    process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL?.trim() || 'https://plausible.io/js/script.tagged-events.js';

  return <Script defer data-domain={domain} src={url} strategy="afterInteractive" />;
}
