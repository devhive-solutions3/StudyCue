import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacy policy · StudyCue Web' };

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl space-y-5 leading-relaxed text-text-secondary">
      <h1 className="font-serif text-4xl text-text-primary">Privacy policy</h1>
      <p>
        Account authentication stores your email or OAuth linkage. Planner data is kept under your account scope and
        protected by owner-only access rules.
      </p>
      <h2 className="font-serif text-2xl text-text-primary">Advertising disclosure</h2>
      <p>
        Personalized ads may appear on public `/`, `/blog/*`, and `/resources/*` pages after affirmative consent
        (`studycue.ads_consent` localStorage equals granted). AdSense is configured for manual placements only, with
        auto-ads disabled.
      </p>
      <p>
        You may opt-out of Google&apos;s personalization via Google&apos;s Ad Settings dashboard; clearing consent here keeps third-party creatives off-session.
      </p>
      <h2 className="font-serif text-2xl text-text-primary">Cookies</h2>
      <p>`/api/session` sets secure HTTP-only ID token echoes for middleware; CMP handles marketing cookies.</p>
      <h2 className="font-serif text-2xl text-text-primary">Minors</h2>
      <p>
        Operators should obtain guardian consent prior to enrolling under-13 planners; personalization flags default conservative where jurisdiction requires.
      </p>
    </div>
  );
}
