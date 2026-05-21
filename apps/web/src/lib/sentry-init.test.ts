import { describe, expect, it } from 'vitest';
import { redactPii, scrubSentryEvent } from './sentry-init';

describe('redactPii', () => {
  it('redacts JSON-shaped child/parent identifiers', () => {
    const input =
      'Failed to save {"nickname":"Penguin","childName":"Mila","child_name":"mila","email":"a@b.co"}';
    const out = redactPii(input);
    expect(out).not.toContain('Penguin');
    expect(out).not.toContain('Mila');
    expect(out).not.toContain('a@b.co');
    expect(out).toContain('"nickname":"[redacted]"');
    expect(out).toContain('"childName":"[redacted]"');
    expect(out).toContain('"email":"[redacted]"');
  });

  it('redacts display_name, parent_email, phone variants', () => {
    const input =
      '{"display_name":"Bea","displayName":"Bea","parent_email":"p@x.co","parentEmail":"p@x.co","phone":"+1 555 1234","phone_number":"555","phoneNumber":"555"}';
    const out = redactPii(input);
    expect(out).not.toContain('Bea');
    expect(out).not.toContain('p@x.co');
    expect(out).not.toContain('555');
  });

  it('redacts free-form key=value occurrences', () => {
    const input = 'console: nickname=Penguin childName: Mila';
    const out = redactPii(input);
    expect(out).not.toContain('Penguin');
    expect(out).not.toContain('Mila');
  });

  it('leaves non-PII content alone', () => {
    const input = 'AudioContext suspended; retrying playPrompt';
    expect(redactPii(input)).toBe(input);
  });
});

describe('scrubSentryEvent', () => {
  it('strips user identifiers', () => {
    const ev = scrubSentryEvent({
      user: { ip_address: '1.2.3.4', email: 'a@b.co', username: 'kid42' },
    });
    expect(ev.user?.ip_address).toBeUndefined();
    expect(ev.user?.email).toBeUndefined();
    expect(ev.user?.username).toBeUndefined();
  });

  it('strips request cookies + forwarding headers + query_string PII', () => {
    const ev = scrubSentryEvent({
      request: {
        cookies: { sb: 'token' },
        headers: {
          'x-forwarded-for': '1.2.3.4',
          'x-real-ip': '1.2.3.4',
          forwarded: 'for=1.2.3.4',
          cookie: 'sb=token',
          'user-agent': 'test',
        },
        query_string: 'nickname=Penguin&page=1',
      },
    });
    expect(ev.request?.cookies).toBeUndefined();
    expect(ev.request?.headers?.['x-forwarded-for']).toBeUndefined();
    expect(ev.request?.headers?.['x-real-ip']).toBeUndefined();
    expect(ev.request?.headers?.forwarded).toBeUndefined();
    expect(ev.request?.headers?.cookie).toBeUndefined();
    expect(ev.request?.headers?.['user-agent']).toBe('test');
    expect(ev.request?.query_string).not.toContain('Penguin');
  });

  it('redacts PII inside message and exception.value', () => {
    const ev = scrubSentryEvent({
      message: 'crash with {"nickname":"Penguin"}',
      exception: {
        values: [{ value: 'oops {"email":"a@b.co"}' }, { value: 'no pii here' }],
      },
    });
    expect(ev.message).not.toContain('Penguin');
    expect(ev.exception?.values?.[0]?.value).not.toContain('a@b.co');
    expect(ev.exception?.values?.[1]?.value).toBe('no pii here');
  });

  it('redacts PII inside breadcrumb messages and data', () => {
    const ev = scrubSentryEvent({
      breadcrumbs: [
        {
          message: 'save called for {"childName":"Mila"}',
          data: { payload: '{"email":"a@b.co"}', count: 1 as unknown as string },
        },
      ],
    });
    expect(ev.breadcrumbs?.[0]?.message).not.toContain('Mila');
    const payload = ev.breadcrumbs?.[0]?.data?.payload;
    expect(typeof payload === 'string' && payload.includes('a@b.co')).toBe(false);
  });

  it('redacts PII inside contexts.* string fields', () => {
    const ev = scrubSentryEvent({
      contexts: {
        app: { build: 'abc', note: '{"nickname":"Pip"}' },
      },
    });
    const note = ev.contexts?.app?.note;
    expect(typeof note === 'string' && note.includes('Pip')).toBe(false);
  });

  it('is safe on an empty event', () => {
    const ev = scrubSentryEvent({});
    expect(ev).toEqual({});
  });
});
