import { MicIndicator } from '@/components/MicIndicator';
import { GlobalFooter } from '@/components/GlobalFooter';
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
      <head>
        {/*
          S4-4 perf hints: preload the mascot greeting illustration that the
          /play hub renders above the fold and prefetch the active mascot's
          idle Lottie so the first paint isn't blocked on the JSON fetch.
          Both are first-party origin so no `crossOrigin` mismatch with CSP.
        */}
        <link
          rel="preload"
          as="image"
          href="/img/01-me-and-my-world/greeting-wave-smile.svg"
          type="image/svg+xml"
        />
        <link rel="prefetch" as="fetch" href="/lottie/milo-idle.json" crossOrigin="anonymous" />
      </head>
      <body className="bg-[var(--color-surface)] text-[var(--color-ink)] antialiased">
        <Providers>
          {children}
          <MicIndicator />
          {/* GlobalFooter sits inside Providers so it can read translations
              from the I18nProvider. Full-screen game layouts overlay it; the
              lesson player is unaffected. */}
          <GlobalFooter />
        </Providers>
      </body>
    </html>
  );
}
