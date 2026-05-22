import type { Metadata } from 'next';

import { redirect } from 'next/navigation';

import { canonical } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Pricing',
  alternates: { canonical: canonical('/pricing') },
  openGraph: { title: 'StudyCue Pricing', url: canonical('/pricing') },
};

export default function PricingPage() {
  redirect('/features');
}
