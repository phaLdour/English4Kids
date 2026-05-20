import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { MicIndicator } from '@/components/MicIndicator';
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
        <Providers>
          {children}
          <MicIndicator />
        </Providers>
        {/* Privacy link is rendered globally below the app shell. Full-screen
            game layouts cover this footer, so it does not interrupt the
            lesson player. */}
        <footer className="px-[var(--space-4)] py-[var(--space-3)] text-center text-xs text-[var(--color-ink)]">
          <Link href="/privacy" className="underline">
            Privacy
          </Link>
        </footer>
      </body>
    </html>
  );
}
