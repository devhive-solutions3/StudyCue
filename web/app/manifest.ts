import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'StudyCue Planner',
    short_name: 'StudyCue',
    description:
      'StudyCue Planner helps students organize class schedules, tasks, notes, focus sessions, and Cue AI in one calm study workspace.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F6F4FF',
    theme_color: '#6A5FDB',
    icons: [
      {
        src: '/cue-icon.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/cue-icon-light.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
