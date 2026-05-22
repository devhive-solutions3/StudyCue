import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Terms of Use' };

export default function TermsPage() {
  return (
    <div className="max-w-3xl space-y-4 leading-relaxed text-text-secondary">
      <h1 className="font-serif text-4xl text-text-primary">Terms</h1>
      <ol className="list-decimal space-y-2 pl-7">
        <li>Provided &ldquo;as-is&rdquo; while in active beta.</li>
        <li>You own your planner data, protected by account-level access rules.</li>
        <li>Do not use Cue to cheat on graded work.</li>
        <li>Suspend abusive accounts at operator discretion.</li>
      </ol>
    </div>
  );
}
