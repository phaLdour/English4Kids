import type { Preview } from '@storybook/react';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '../src/locales/en/common.json';
import './preview.css';

/**
 * Global decorator that wraps every story in a `NextIntlClientProvider` with
 * the English bundle. Components that call `useTranslations` would otherwise
 * throw inside Storybook because there's no `<I18nProvider>` ancestor.
 *
 * We use the EN bundle as the canonical Storybook locale. Sister subagent's
 * TR work is in flight; once TR coverage stabilizes a per-story toolbar
 * switcher can ride alongside this provider without disturbing the default.
 */

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'surface',
      values: [
        { name: 'surface', value: '#FFF8EE' },
        { name: 'high', value: '#FFFFFF' },
        { name: 'dark', value: '#094074' },
      ],
    },
    a11y: {
      config: {
        rules: [{ id: 'color-contrast', enabled: true }],
      },
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [
    (Story) => (
      <NextIntlClientProvider locale="en" messages={enMessages as Record<string, unknown>}>
        <Story />
      </NextIntlClientProvider>
    ),
  ],
};

export default preview;
