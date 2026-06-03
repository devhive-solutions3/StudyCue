'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

type TermsPrivacyAgreementModalProps = {
  open: boolean;
  busy?: boolean;
  title?: string;
  agreeLabel?: string;
  onAgree: () => void | Promise<void>;
  onClose: () => void;
};

export default function TermsPrivacyAgreementModal({
  open,
  busy = false,
  title = 'Terms and Privacy Agreement',
  agreeLabel = 'I agree',
  onAgree,
  onClose,
}: TermsPrivacyAgreementModalProps) {
  if (!open) return null;

  return (
    <TermsPrivacyAgreementDialog
      busy={busy}
      title={title}
      agreeLabel={agreeLabel}
      onAgree={onAgree}
      onClose={onClose}
    />
  );
}

function TermsPrivacyAgreementDialog({
  busy,
  title,
  agreeLabel,
  onAgree,
  onClose,
}: Omit<TermsPrivacyAgreementModalProps, 'open'> & {
  busy: boolean;
  title: string;
  agreeLabel: string;
}) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [busy, onClose]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-agreement-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-[24px] border border-border bg-surface shadow-[0_30px_80px_rgba(9,12,35,0.35)]">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 id="legal-agreement-title" className="font-serif text-2xl text-text-primary">
              {title}
            </h2>
            <p className="mt-1 text-sm leading-6 text-text-secondary">
              Please review the summary below before creating or continuing your account.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            disabled={busy}
            className="sc-focus-ring rounded-[12px] border border-border px-3 py-2 text-sm text-text-secondary hover:bg-surface-2 disabled:opacity-50"
            aria-label="Close terms and privacy agreement"
          >
            Close
          </button>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto px-5 py-5 text-sm leading-7 text-text-secondary"
          tabIndex={0}
          onScroll={(event) => {
            const target = event.currentTarget;
            const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
            if (distanceFromBottom <= 8) setScrolledToBottom(true);
          }}
        >
          <div className="space-y-5">
            <section>
              <h3 className="text-base font-semibold text-text-primary">Beta service</h3>
              <p className="mt-2">
                StudyCue Planner is in active beta. Features, limits, pricing, availability, and
                study tools may change as the product improves. Some beta features may be limited,
                interrupted, or removed.
              </p>
            </section>
            <section>
              <h3 className="text-base font-semibold text-text-primary">Account responsibility</h3>
              <p className="mt-2">
                You are responsible for keeping your account secure and for activity under your
                account. Use StudyCue for lawful, respectful study planning and do not attempt to
                abuse, spam, scrape, disrupt, or bypass platform security.
              </p>
            </section>
            <section>
              <h3 className="text-base font-semibold text-text-primary">Planner, task, and note data</h3>
              <p className="mt-2">
                You may save schedules, tasks, notes, study materials, focus sessions, quiz outputs,
                flashcards, and other planner information. You remain responsible for the content you
                add and for checking important deadlines, dates, and study outputs.
              </p>
            </section>
            <section>
              <h3 className="text-base font-semibold text-text-primary">Cue AI limitations</h3>
              <p className="mt-2">
                Cue AI is a study assistant, not a teacher, adviser, or source of guaranteed answers.
                Do not use Cue AI to cheat, submit generated answers as your own where prohibited, or
                violate your school&apos;s rules.
              </p>
            </section>
            <section>
              <h3 className="text-base font-semibold text-text-primary">Free plan, ads, and cookies</h3>
              <p className="mt-2">
                The Free plan may include advertising. Ads may be delivered by third-party partners
                such as Google AdSense. Third-party vendors, including Google, may use cookies or
                similar technologies to serve ads based on visits to StudyCue Planner and other
                websites.
              </p>
            </section>
            <section>
              <h3 className="text-base font-semibold text-text-primary">Full policies</h3>
              <p className="mt-2">
                By selecting &ldquo;I agree,&rdquo; you confirm that you have read and agree to the{' '}
                <Link href="/terms" target="_blank" className="font-semibold text-accent underline underline-offset-4">
                  Terms of Use
                </Link>
                ,{' '}
                <Link href="/privacy" target="_blank" className="font-semibold text-accent underline underline-offset-4">
                  Privacy Policy
                </Link>
                , and{' '}
                <Link href="/cookies" target="_blank" className="font-semibold text-accent underline underline-offset-4">
                  Cookies Policy
                </Link>
                .
              </p>
            </section>
            <p className="rounded-[16px] border border-border bg-surface-2 px-4 py-3 text-xs leading-6 text-text-muted">
              Scroll to the bottom of this agreement to enable the agreement button.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-text-muted">
            Last updated: June 1, 2026
          </p>
          <button
            type="button"
            disabled={!scrolledToBottom || busy}
            onClick={() => void onAgree()}
            className="sc-btn-primary sc-focus-ring justify-center disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Saving…' : agreeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
