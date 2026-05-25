import Link from 'next/link';
import type { ReactNode } from 'react';

import AnimatedStudyCueLogo from '@/components/AnimatedStudyCueLogo';
import MarketingThemeToggle from '@/components/marketing/MarketingThemeToggle';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/blog', label: 'Blog' },
  { href: '/help', label: 'Help' },
  { href: '/contact', label: 'Contact' },
];

export default function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col text-text-primary" style={{ background: 'transparent' }}>
      <header
        className="sticky top-0 z-40"
        style={{
          background: 'var(--sc-header-bg)',
          borderBottom: '1px solid var(--sc-header-border)',
          backdropFilter: 'blur(18px) saturate(140%)',
          WebkitBackdropFilter: 'blur(18px) saturate(140%)',
        }}
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-6 px-4 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span
              className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-[12px]"
              style={{ background: 'var(--sc-accent-soft)' }}
            >
              <AnimatedStudyCueLogo
                size={36}
                ariaLabel="StudyCue mascot"
                className="h-9 w-9 rounded-[10px]"
              />
            </span>
            <span
              className="font-serif text-[22px] leading-none tracking-tight"
              style={{ color: 'var(--sc-text-primary)' }}
            >
              Study<span style={{ color: 'var(--sc-accent)' }}>Cue</span> Planner
            </span>
          </Link>
          <nav className="flex flex-wrap gap-1 text-sm md:gap-2">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-[12px] px-3 py-2 transition"
                style={{ color: 'var(--sc-text-secondary)' }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 text-sm sm:gap-3">
            <MarketingThemeToggle />
            <Link
              href="/login"
              className="rounded-[12px] px-3 py-2 transition sm:px-4"
              style={{ color: 'var(--sc-text-secondary)' }}
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="rounded-[14px] px-4 py-2 font-semibold text-white sm:px-5"
              style={{
                background: 'var(--sc-accent)',
                boxShadow: 'var(--sc-shadow-accent)',
              }}
            >
              Start free
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-14">{children}</main>

      <footer
        className="px-4 py-12 text-sm"
        style={{
          background: 'var(--sc-surface)',
          color: 'var(--sc-text-secondary)',
          borderTop: '1px solid var(--sc-border)',
        }}
      >
        <div className="mx-auto mt-10 grid max-w-5xl gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-semibold" style={{ color: 'var(--sc-text-primary)' }}>
              StudyCue Planner
            </p>
            <p className="mt-2 leading-relaxed">
              StudyCue Planner is a smart study planner for students by Solutions DevHive. Plan schoolwork, organize
              notes, manage class schedules, and stay focused with Cue AI.
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-semibold" style={{ color: 'var(--sc-text-primary)' }}>
              Explore
            </p>
            <FooterLink href="/">Home</FooterLink>
            <FooterLink href="/features">Features</FooterLink>
            <FooterLink href="/pricing">Pricing</FooterLink>
            <FooterLink href="/blog">Blog</FooterLink>
            <FooterLink href="/help">Help</FooterLink>
            <FooterLink href="/contact">Contact</FooterLink>
          </div>
          <div className="space-y-2">
            <p className="font-semibold" style={{ color: 'var(--sc-text-primary)' }}>
              Legal
            </p>
            <FooterLink href="/cookies">Cookies</FooterLink>
            <FooterLink href="/privacy">Privacy</FooterLink>
            <FooterLink href="/terms">Terms</FooterLink>
          </div>
          <div className="space-y-2">
            <p className="font-semibold" style={{ color: 'var(--sc-text-primary)' }}>
              StudyCue Planner
            </p>
            <FooterLink href="/features">Calendar and schedules</FooterLink>
            <FooterLink href="/features">Tasks and deadlines</FooterLink>
            <FooterLink href="/features">Notes</FooterLink>
            <FooterLink href="/features">Focus timer</FooterLink>
            <FooterLink href="/features">Cue AI</FooterLink>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="block transition hover:text-text-primary">
      {children}
    </Link>
  );
}
