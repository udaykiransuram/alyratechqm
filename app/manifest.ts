import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Precision Diagnostics',
    short_name: 'Diagnostics',
    description:
      'Marks show scores. We show understanding. Diagnose concept, procedure, and prerequisite gaps to drive visible growth.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0b1220',
    icons: [
      {
        src: '/favicon.ico',
        sizes: '48x48 72x72 96x96 144x144 192x192',
        type: 'image/x-icon',
      },
    ],
  };
}
