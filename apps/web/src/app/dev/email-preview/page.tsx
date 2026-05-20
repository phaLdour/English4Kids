'use client';

/**
 * Sprint 5 S5-4: dev-only email-template previewer.
 *
 * URL: /dev/email-preview?template=vpc-first-confirmation
 *
 * Gated behind `NEXT_PUBLIC_E4K_ENV !== 'production'` — production builds
 * render a 404-equivalent placeholder. The page lives under `/dev` rather
 * than `/parent` so it never appears in a parent-facing nav surface.
 */

import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo } from 'react';
import {
  DEFAULT_PREVIEW_DATA,
  PREVIEW_TEMPLATE_NAMES,
  type PreviewTemplateName,
  renderPreview,
} from '@/lib/email-preview';

function PreviewContent(): React.JSX.Element {
  const params = useSearchParams();
  const requested = params.get('template') as PreviewTemplateName | null;
  const template: PreviewTemplateName = useMemo(() => {
    if (requested && PREVIEW_TEMPLATE_NAMES.includes(requested)) return requested;
    return 'vpc-first-confirmation';
  }, [requested]);

  const rendered = useMemo(() => renderPreview(template, DEFAULT_PREVIEW_DATA), [template]);

  return (
    <main
      style={{
        padding: 24,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: '#1f2937',
        maxWidth: 960,
        margin: '0 auto',
      }}
    >
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Email template preview</h1>
      <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
        Dev-only. Hidden in production builds. Use the links below to switch templates.
      </p>
      <nav style={{ marginBottom: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {PREVIEW_TEMPLATE_NAMES.map((name) => (
          <a
            key={name}
            href={`?template=${name}`}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              backgroundColor: template === name ? '#0f3d3e' : '#e5e7eb',
              color: template === name ? '#ffffff' : '#1f2937',
              textDecoration: 'none',
              fontSize: 13,
            }}
          >
            {name}
          </a>
        ))}
      </nav>
      <section
        style={{
          marginBottom: 16,
          padding: 16,
          backgroundColor: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
        }}
      >
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Subject</h2>
        <code style={{ display: 'block', wordBreak: 'break-word' }}>{rendered.subject}</code>
      </section>
      <section
        style={{
          marginBottom: 16,
          padding: 0,
          backgroundColor: '#f7f5ef',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          overflow: 'hidden',
        }}
        aria-label="HTML preview"
      >
        <h2 style={{ fontSize: 16, margin: '12px 16px' }}>HTML preview</h2>
        <iframe
          title="Email HTML preview"
          srcDoc={rendered.html}
          style={{ width: '100%', height: 720, border: 'none', backgroundColor: '#ffffff' }}
          sandbox=""
        />
      </section>
      <section
        style={{
          marginBottom: 16,
          padding: 16,
          backgroundColor: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
        }}
      >
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Plain-text fallback</h2>
        <pre
          style={{
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
            fontSize: 13,
            color: '#1f2937',
          }}
        >
          {rendered.text}
        </pre>
      </section>
    </main>
  );
}

export default function EmailPreviewPage(): React.JSX.Element {
  // Hard gate: production builds render nothing. We don't render a 404
  // explicitly because Next routes here would still be in the build; the
  // page just becomes a useless surface. The route should also be excluded
  // from sitemap generation (handled by Next's default sitemap exclude).
  if (process.env.NEXT_PUBLIC_E4K_ENV === 'production') {
    return (
      <main style={{ padding: 24, fontFamily: 'system-ui' }}>
        <p>Not available in production.</p>
      </main>
    );
  }
  return (
    <Suspense fallback={<p style={{ padding: 24 }}>Loading preview...</p>}>
      <PreviewContent />
    </Suspense>
  );
}
