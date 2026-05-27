'use client';

const ICONS = {
  dashboard: (
    <path d="M3 9.5l5-4 5 4M4.5 8.5V13h7V8.5" />
  ),
  calendar: (
    <>
      <rect x="3" y="4.5" width="10" height="8.5" rx="1.5" />
      <path d="M6 3v3M10 3v3M3 7h10" />
    </>
  ),
  tasks: (
    <>
      <path d="M5.2 5.4h7M5.2 8h7M5.2 10.6h7" />
      <path d="M3.2 5.4h.1M3.2 8h.1M3.2 10.6h.1" />
    </>
  ),
  stats: (
    <>
      <path d="M3.5 11.5h10" />
      <rect x="4.2" y="8.6" width="1.8" height="2.9" rx=".3" />
      <rect x="7.2" y="7.1" width="1.8" height="4.4" rx=".3" />
      <rect x="10.2" y="5.6" width="1.8" height="5.9" rx=".3" />
    </>
  ),
  classes: (
    <>
      <path d="M2.8 6.2L8 3.8l5.2 2.4L8 8.6z" />
      <path d="M4.5 7.2v3.2c0 .7 1.6 1.4 3.5 1.4s3.5-.7 3.5-1.4V7.2" />
    </>
  ),
  timer: (
    <>
      <circle cx="8" cy="8.5" r="4.4" />
      <path d="M8 2.8V4M6.2 2.8h3.6M8 8.5l2-1.4" />
    </>
  ),
  notes: (
    <>
      <rect x="3.2" y="3.8" width="9.6" height="9.2" rx="1.3" />
      <path d="M5.3 7h5.4M5.3 9.2h5.4" />
    </>
  ),
  settings: (
    <>
      <circle cx="8" cy="8" r="1.8" />
      <path d="M8 3.2v1.1M8 11.7v1.1M12.8 8h-1.1M4.3 8H3.2M11.4 4.6l-.8.8M5.4 10.6l-.8.8M11.4 11.4l-.8-.8M5.4 5.4l-.8-.8" />
    </>
  ),
  bug: (
    <>
      <ellipse cx="8" cy="9.2" rx="3.2" ry="3.6" />
      <path d="M5.2 7.8L3 6.2M10.8 7.8L13 6.2M5 10.8L2.8 10.8M11 10.8l2.2 0M8 5.8V4.2" />
      <circle cx="6.6" cy="8.8" r=".45" fill="currentColor" stroke="none" />
      <circle cx="9.4" cy="8.8" r=".45" fill="currentColor" stroke="none" />
    </>
  ),
  profile: (
    <>
      <circle cx="8" cy="6.2" r="2.1" />
      <path d="M4.2 12.4c.7-1.6 2-2.4 3.8-2.4s3.1.8 3.8 2.4" />
    </>
  ),
  cue: (
    <path d="M8 3.2l1.4 3.2 3.4.3-2.6 2.2.8 3.3L8 10.6l-3 1.6.8-3.3L3.2 6.7l3.4-.3z" />
  ),
  cloud: (
    <path d="M5.1 11.5h5.7a2.1 2.1 0 0 0 .2-4.2 3.2 3.2 0 0 0-6-.7A2.1 2.1 0 0 0 5.1 11.5z" />
  ),
  plus: (
    <path d="M8 4.5v7M4.5 8h7" />
  ),
  menu: (
    <path d="M3.5 5.2h9M3.5 8h9M3.5 10.8h9" />
  ),
  search: (
    <>
      <circle cx="7.1" cy="7.1" r="2.9" />
      <path d="M9.2 9.2l3 3" />
    </>
  ),
  bell: (
    <>
      <path d="M8 3.6a2.6 2.6 0 0 0-2.6 2.6v1.2c0 .8-.3 1.6-.8 2.2l-.4.4h6.8l-.4-.4a3.4 3.4 0 0 1-.8-2.2V6.2A2.6 2.6 0 0 0 8 3.6z" />
      <path d="M6.6 10.8a1.4 1.4 0 0 0 2.8 0" />
    </>
  ),
  left: (
    <path d="M9.8 4.4L6.2 8l3.6 3.6" />
  ),
  right: (
    <path d="M6.2 4.4L9.8 8l-3.6 3.6" />
  ),
} as const;

export type IconName = keyof typeof ICONS;

export function IconGlyph({ name, className = '' }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-[18px] w-[18px] text-current ${className}`}
    >
      {ICONS[name]}
    </svg>
  );
}
