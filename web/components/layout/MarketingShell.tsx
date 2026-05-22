import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import AdSenseSlot from '@/components/ads/AdSenseSlot';

const NAV = [
  { href: '/features', label: 'Features' },
  { href: '/blog', label: 'Blog' },
  { href: '/help', label: 'Help' },
  { href: '/contact', label: 'Contact' },
];

export default function MarketingShell({
  children,
  showAds = false,
}: {
  children: ReactNode;
  showAds?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col text-text-primary" style={{ background: 'transparent' }}>
      <header
        className="sticky top-0 z-40"
        style={{
          background: 'color-mix(in srgb, var(--sc-surface) 80%, transparent)',
          borderBottom: '1px solid var(--sc-border)',
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
              <Image
                src="/cue-icon-light.png"
                alt="StudyCue"
                width={40}
                height={40}
                className="h-9 w-9 object-cover dark:hidden"
                priority
              />
              <Image
                src="/cue-icon-dark-cropped.png"
                alt="StudyCue"
                width={40}
                height={40}
                className="hidden h-9 w-9 object-cover dark:block"
                priority
              />
            </span>
            <span
              className="font-serif text-[22px] leading-none tracking-tight"
              style={{ color: 'var(--sc-text-primary)' }}
            >
              Study<span style={{ color: 'var(--sc-accent)' }}>Cue</span>
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
          <div className="ml-auto flex gap-3 text-sm">
            <Link
              href="/login"
              className="rounded-[12px] px-4 py-2 transition"
              style={{ color: 'var(--sc-text-secondary)' }}
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="rounded-[14px] px-5 py-2 font-semibold text-white"
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
      {showAds ? <AdSenseSlot /> : null}

      <footer
        className="px-4 py-12 text-sm"
        style={{
          background: 'var(--sc-surface)',
          color: 'var(--sc-text-secondary)',
          borderTop: '1px solid var(--sc-border)',
        }}
      >
        <div className="mx-auto grid max-w-5xl gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-semibold" style={{ color: 'var(--sc-text-primary)' }}>
              StudyCue
            </p>
            <p className="mt-2 leading-relaxed">
              Local-first planner on mobile with a clean web cockpit.
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-semibold" style={{ color: 'var(--sc-text-primary)' }}>
              Company
            </p>
            <FooterLink href="/contact">Contact</FooterLink>
            <FooterLink href="/features">Features</FooterLink>
          </div>
          <div className="space-y-2">
            <p className="font-semibold" style={{ color: 'var(--sc-text-primary)' }}>
              Legal
            </p>
            <FooterLink href="/privacy">Privacy</FooterLink>
            <FooterLink href="/terms">Terms</FooterLink>
            <FooterLink href="/cookies">Cookies</FooterLink>
          </div>
          <div className="space-y-2">
            <p className="font-semibold" style={{ color: 'var(--sc-text-primary)' }}>
              Study
            </p>
            <FooterLink href="/blog">Blog</FooterLink>
            <FooterLink href="/help">Help / FAQ</FooterLink>
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
