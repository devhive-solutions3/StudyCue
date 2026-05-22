import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Cookie policy', description: 'How StudyCue gates AdSense analytics cookies.' };

export default function CookiesPage() {
  return (
    <div className="max-w-3xl space-y-4 leading-relaxed text-text-secondary">
      <h1 className="font-serif text-4xl text-text-primary">Cookie & consent policy</h1>
      <p>
        Functional cookies persist authentication between `/api/session` hops. Personalized advertising cookies load only after you Accept on the bottom banner —
        rejecting keeps AdSense creatives disabled while still browsing marketing pages freely.
      </p>
      <p>
        Plausible respects DNT-compatible defaults and aggregates visit counts without profile IDs tied to minors.
      </p>
      <ul className="list-disc space-y-2 pl-7">
        <li>Consent key: localStorage studycue.ads_consent</li>
        <li>You can revoke by clearing browser storage or toggling Manage options (future deep-link to CMP).</li>
      </ul>
    </div>
  );
}
