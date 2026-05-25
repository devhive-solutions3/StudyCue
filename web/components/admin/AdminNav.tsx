'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type AdminNavItem = {
  title: string;
  href: string;
};

export default function AdminNav({
  items,
}: {
  items: AdminNavItem[];
}) {
  const pathname = usePathname();

  return (
    <nav className="rounded-[28px] border border-white/10 bg-white/5 p-3 shadow-[0_18px_48px_rgba(9,12,35,0.2)] backdrop-blur-xl dark:border-white/8 dark:bg-white/6">
      <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={clsx(
                  'flex min-h-12 items-center justify-between gap-3 rounded-2xl border px-5 py-3 text-sm font-semibold transition',
                  active
                    ? 'border-accent/40 bg-accent/18 text-text-primary shadow-[0_14px_28px_rgba(106,95,219,0.18)]'
                    : 'border-white/8 bg-black/0 text-text-secondary hover:border-accent/25 hover:bg-white/8 hover:text-text-primary',
                )}
              >
                <span className="whitespace-nowrap">{item.title}</span>
                <span className={clsx('shrink-0 text-xs uppercase tracking-[0.2em]', active ? 'text-accent' : 'text-text-muted')}>
                  {active ? 'Live' : 'Open'}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
