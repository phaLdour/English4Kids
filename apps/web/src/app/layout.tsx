import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'English4Kids',
  description: 'Audio-rich English learning adventures for kids 6 to 12.',
  applicationName: 'English4Kids',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#FFF8EE',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="default">
      <body className="bg-[var(--color-surface)] text-[var(--color-ink)] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
