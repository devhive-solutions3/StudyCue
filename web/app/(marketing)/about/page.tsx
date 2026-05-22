import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { canonical } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'About StudyCue',
  alternates: { canonical: canonical('/about') },
};

export default function AboutPage() {
  redirect('/features');
}
