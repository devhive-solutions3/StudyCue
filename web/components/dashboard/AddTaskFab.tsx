'use client';

import Image from 'next/image';
import Link from 'next/link';

import { useDashboardUi } from '@/context/dashboard-ui';

export default function AddTaskFab() {
  const { focusLocked } = useDashboardUi();
  return (
    <Link
      href="/app/chat"
      aria-label="Open Cue"
      onClick={(event) => {
        if (focusLocked) {
          event.preventDefault();
          window.alert('Please focus on your studies for now or end the session.');
        }
      }}
      className="sc-floating-cue inline-flex items-center justify-center overflow-visible"
    >
      <Image
        src="/cue-icon-light.png"
        alt="Cue"
        width={78}
        height={78}
        className="h-[78px] w-[78px] object-contain dark:hidden"
        priority
      />
      <Image
        src="/cue-icon-dark-cropped.png"
        alt="Cue"
        width={78}
        height={78}
        className="hidden h-[78px] w-[78px] object-contain dark:block"
        priority
      />
    </Link>
  );
}
