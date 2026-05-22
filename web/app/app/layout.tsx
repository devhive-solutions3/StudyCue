import type { Metadata } from 'next';

import AppWorkspaceProviders from './AppWorkspaceProviders';

export const metadata: Metadata = {
  title: 'Web dashboard',
  robots: { index: false, follow: false },
};

export default function AppAreaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AppWorkspaceProviders>{children}</AppWorkspaceProviders>;
}
