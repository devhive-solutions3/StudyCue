import type { Metadata } from 'next';
import Link from 'next/link';

import { FREE_PLAN_FEATURES, STUDYCUE_PLUS_FEATURES, USER_PLAN_CONFIG } from '@/lib/user-plan';
import { canonical } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'StudyCue Plans | Free Beta and Plus',
  description:
    'Compare StudyCue Free, Beta, and StudyCue Plus plans. Core planning features stay available, with higher limits, no ads, customization, and exports planned for Plus.',
  alternates: { canonical: canonical('/pricing') },
  openGraph: {
    title: 'StudyCue Plans | Free Beta and Plus',
    description:
      'Compare StudyCue Free, Beta, and StudyCue Plus plans. Core planning features stay available, with higher limits, no ads, customization, and exports planned for Plus.',
    url: canonical('/pricing'),
  },
};

const FAQS = [
  {
    question: 'Is StudyCue free during beta?',
    answer:
      'Yes. During beta, students can create an account and use current StudyCue features while helping test the platform.',
  },
  {
    question: 'Will Beta users be charged automatically?',
    answer:
      'No. There is no automatic charge and no payment flow connected right now.',
  },
  {
    question: 'Is StudyCue Plus available now?',
    answer:
      'Not yet. StudyCue Plus is planned, and the current Plus button is marked Coming Soon.',
  },
  {
    question: 'Will core features be locked?',
    answer:
      'Core planning features are intended to stay available. Plus focuses on higher limits, no ads, reports, customization, and future group planning.',
  },
  {
    question: 'What is included in Free?',
    answer:
      'Free includes the core planner with starter limits and ads.',
  },
] as const;

function planPriceLabel(amount: number) {
  return amount === 0 ? '₱0' : `₱${amount}/month`;
}

function formatStorage(bytes: number) {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb} GB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

type PlanCardProps = {
  badge: string;
  title: string;
  price: string;
  subtitle: string;
  features: readonly string[];
  ctaLabel: string;
  ctaHref?: string;
  disabled?: boolean;
  note?: string;
  emphasis?: 'free' | 'beta' | 'plus';
};

function PlanCard({
  badge,
  title,
  price,
  subtitle,
  features,
  ctaLabel,
  ctaHref,
  disabled,
  note,
  emphasis = 'free',
}: PlanCardProps) {
  const tones =
    emphasis === 'beta'
      ? {
          shell:
            'border-accent/30 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--sc-accent)_10%,var(--sc-surface)),var(--sc-surface))] shadow-[0_22px_60px_rgba(106,95,219,0.16)]',
          badge: 'bg-accent/14 text-accent border border-accent/20',
          button:
            'bg-accent text-white shadow-[var(--sc-shadow-accent)] hover:opacity-95',
        }
      : emphasis === 'plus'
        ? {
            shell:
              'border-[rgba(126,103,255,0.24)] bg-[linear-gradient(180deg,rgba(45,35,88,0.92),rgba(23,19,48,0.96))] text-white shadow-[0_24px_70px_rgba(37,29,84,0.42)] dark:border-[rgba(171,151,255,0.26)]',
            badge: 'bg-white/10 text-white border border-white/14',
            button:
              'bg-white/12 text-white ring-1 ring-white/18',
          }
        : {
            shell: 'border-border bg-surface shadow-[var(--sc-shadow-card)]',
            badge: 'bg-surface-2 text-text-secondary border border-border',
            button:
              'bg-surface-2 text-text-primary ring-1 ring-border hover:bg-accent-light',
          };

  const contentTone =
    emphasis === 'plus'
      ? {
          heading: 'text-white',
          subtext: 'text-white/76',
          item: 'text-white/86',
          note: 'text-white/68',
        }
      : {
          heading: 'text-text-primary',
          subtext: 'text-text-secondary',
          item: 'text-text-primary',
          note: 'text-text-muted',
        };

  return (
    <article className={`flex h-full flex-col rounded-[30px] border p-6 ${tones.shell}`}>
      <div className={`inline-flex w-fit rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${tones.badge}`}>
        {badge}
      </div>
      <div className="mt-5">
        <h2 className={`text-2xl font-semibold ${contentTone.heading}`}>{title}</h2>
        <p className={`mt-3 text-4xl font-black tracking-[-0.05em] ${contentTone.heading}`}>{price}</p>
        <p className={`mt-3 text-sm leading-6 ${contentTone.subtext}`}>{subtitle}</p>
      </div>
      <ul className="mt-6 flex-1 space-y-3">
        {features.map((feature) => (
          <li key={feature} className={`flex items-start gap-3 text-sm leading-6 ${contentTone.item}`}>
            <span className="mt-[5px] inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <div className="mt-8 pt-2">
        {disabled ? (
          <button
            type="button"
            aria-disabled="true"
            disabled
            className={`inline-flex min-h-[48px] w-full items-center justify-center rounded-[16px] px-5 text-sm font-semibold opacity-80 ${tones.button}`}
          >
            {ctaLabel}
          </button>
        ) : (
          <Link
            href={ctaHref ?? '/register'}
            className={`inline-flex min-h-[48px] w-full items-center justify-center rounded-[16px] px-5 text-sm font-semibold transition ${tones.button}`}
          >
            {ctaLabel}
          </Link>
        )}
        {note ? <p className={`mt-3 text-xs leading-5 ${contentTone.note}`}>{note}</p> : null}
      </div>
    </article>
  );
}

export default function PricingPage() {
  const free = USER_PLAN_CONFIG.free;
  const beta = USER_PLAN_CONFIG.beta;
  const premium = USER_PLAN_CONFIG.premium;

  const freeFeatures = [
    ...FREE_PLAN_FEATURES.slice(0, 5),
    'Basic stats',
    'Cloud sync',
    `${formatStorage(free.storageLimitBytes)} notes/file storage`,
    `${free.cueDailyLimit} Cue AI messages per day`,
    `${free.scheduleImageImportsMonthly} schedule image imports per month`,
    'Ads supported',
  ];

  const betaFeatures = [
    'Same core planner access',
    'Same premium feature access during beta',
    `${formatStorage(beta.storageLimitBytes)} notes/file storage`,
    `${beta.cueDailyLimit} Cue AI messages per day`,
    `${beta.scheduleImageImportsMonthly} schedule image imports per month`,
    'No ads during beta',
    'Advanced stats access',
    'Export/report features when available',
    'Early access to future tools',
  ];

  const premiumFeatures = [
    'No ads',
    `${formatStorage(premium.storageLimitBytes)} notes/file storage`,
    `${premium.cueDailyLimit} Cue AI messages per day`,
    `${premium.scheduleImageImportsMonthly} schedule image imports per month`,
    ...STUDYCUE_PLUS_FEATURES.slice(4),
  ];

  return (
    <div className="space-y-12">
      <section className="rounded-[32px] border border-border bg-surface px-6 py-8 shadow-[var(--sc-shadow-card)] md:px-8 md:py-10">
        <div className="inline-flex rounded-full border border-accent/20 bg-accent/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
          Beta access active
        </div>
        <h1 className="mt-5 max-w-3xl font-serif text-4xl text-text-primary md:text-5xl">
          StudyCue plans built around student life.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-text-secondary">
          Start with the core StudyCue planner for free. During beta, testers can explore premium-like features while we continue improving the student workspace.
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <PlanCard
          badge="Free"
          title="Free"
          price={planPriceLabel(free.pricePhpMonthly)}
          subtitle="Core planning tools with starter limits."
          features={freeFeatures}
          ctaLabel="Start free"
          ctaHref="/register"
          emphasis="free"
        />
        <PlanCard
          badge="Beta Testing"
          title="Beta"
          price="Free during beta"
          subtitle="Premium-like feature access while helping test StudyCue."
          features={betaFeatures}
          ctaLabel="Join beta"
          ctaHref="/register"
          note="Beta access is available while the beta phase is active."
          emphasis="beta"
        />
        <PlanCard
          badge="Coming Soon"
          title="StudyCue Plus"
          price="Coming soon"
          subtitle="Higher limits, no ads, customization, reports, and future group planning."
          features={premiumFeatures}
          ctaLabel="Coming Soon"
          disabled
          emphasis="plus"
        />
      </section>

      <section className="rounded-[30px] border border-border bg-surface px-6 py-7 shadow-[var(--sc-shadow-card)] md:px-8">
        <h2 className="text-2xl font-semibold text-text-primary">Core StudyCue features stay available.</h2>
        <p className="mt-4 max-w-4xl text-sm leading-7 text-text-secondary">
          StudyCue&apos;s main planning workspace stays available across plans. Dashboard, calendar, tasks, basic notes, focus timer, cloud sync, and Cue AI planning context are part of the core experience. Plan differences focus on limits, customization, reports, storage, ads, and future collaboration tools.
        </p>
      </section>

      <section className="rounded-[30px] border border-border bg-surface px-6 py-7 shadow-[var(--sc-shadow-card)] md:px-8">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.3em] text-text-muted">FAQ</p>
          <h2 className="mt-3 text-2xl font-semibold text-text-primary">Questions students usually ask first.</h2>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {FAQS.map((item) => (
            <article key={item.question} className="rounded-[22px] border border-border bg-surface-2 p-5">
              <h3 className="text-base font-semibold text-text-primary">{item.question}</h3>
              <p className="mt-3 text-sm leading-7 text-text-secondary">{item.answer}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
