/**
 * Tests for the content-client adapter. The adapter sits between the lesson
 * player / story / song UI and the runtime content source (live Next route
 * handler on the web, baked static export inside the Capacitor WebView).
 *
 * Sprint-6 QA-Lead Iteration 2 closes Critic-3 S1-C: the previously placeholder
 * `isCapacitor()` branch in `endpoint()` is now covered by an explicit
 * fallback to a `.txt` sibling when the primary URL 404s under Capacitor.
 * These tests pin both the happy path and the fallback so future static-export
 * filename changes can't silently break native content loading.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAudioMap,
  getPhonemeMap,
  getSong,
  getStory,
  getUnit,
} from './content-client';

// Mock `runtime-adapter.isCapacitor` so we can flip between web and native
// without booting the real Capacitor host shim.
const capacitorFlag = { value: false };
vi.mock('./runtime-adapter', () => ({
  isCapacitor: () => capacitorFlag.value,
}));

interface FetchCall {
  url: string;
  init?: RequestInit;
}

function installFetch(handlers: Array<(call: FetchCall) => Response | undefined>): {
  calls: FetchCall[];
} {
  const calls: FetchCall[] = [];
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : String(input);
    const call: FetchCall = { url, init };
    calls.push(call);
    for (const handler of handlers) {
      const out = handler(call);
      if (out) return Promise.resolve(out);
    }
    return Promise.resolve(new Response('not found', { status: 404 }));
  }) as typeof fetch;
  return { calls };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  capacitorFlag.value = false;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('content-client.getUnit', () => {
  it('fetches `/api/content/<unitId>` on the web', async () => {
    const sample = {
      id: '01-me-and-my-world',
      title: 'Me and My World',
      theme: 'self',
      cefr: 'Pre-A1',
      orderIndex: 0,
      lessons: [],
    };
    const { calls } = installFetch([
      (c) => (c.url === '/api/content/01-me-and-my-world' ? jsonResponse(sample) : undefined),
    ]);
    const unit = await getUnit('01-me-and-my-world');
    expect(unit.id).toBe('01-me-and-my-world');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('/api/content/01-me-and-my-world');
  });

  it('falls back to `.txt` sibling under Capacitor when canonical URL 404s', async () => {
    capacitorFlag.value = true;
    const sample = {
      id: '01-me-and-my-world',
      title: 'Me and My World',
      theme: 'self',
      cefr: 'Pre-A1',
      orderIndex: 0,
      lessons: [],
    };
    const { calls } = installFetch([
      (c) => (c.url === '/api/content/01-me-and-my-world.txt' ? jsonResponse(sample) : undefined),
    ]);
    const unit = await getUnit('01-me-and-my-world');
    expect(unit.id).toBe('01-me-and-my-world');
    expect(calls).toHaveLength(2);
    expect(calls[0]?.url).toBe('/api/content/01-me-and-my-world');
    expect(calls[1]?.url).toBe('/api/content/01-me-and-my-world.txt');
  });

  it('does NOT probe the `.txt` fallback on the web — extra request would waste budget', async () => {
    capacitorFlag.value = false;
    const { calls } = installFetch([
      // Both URLs would return 404; first hit is enough to throw.
    ]);
    await expect(getUnit('01-me-and-my-world')).rejects.toThrow(/returned 404/);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('/api/content/01-me-and-my-world');
  });

  it('URL-encodes the unitId so a malicious value cannot escape the path', async () => {
    const { calls } = installFetch([
      (c) => (c.url === '/api/content/..%2F..%2Fetc%2Fpasswd' ? jsonResponse({}) : undefined),
    ]);
    try {
      await getUnit('../../etc/passwd');
    } catch {
      // schema parse will fail — the assertion we care about is the URL.
    }
    expect(calls[0]?.url).toBe('/api/content/..%2F..%2Fetc%2Fpasswd');
  });
});

describe('content-client.getSong', () => {
  it('hits the `/api/content/songs/<id>` route', async () => {
    const sample = {
      id: 's-1',
      title: 'Hello Friend',
      lrc: '[00:00.00]Hello friend',
      audioRef: 'aud.song.helloFriend',
      targetVocabRefs: ['voc.hello'],
    };
    const { calls } = installFetch([
      (c) => (c.url === '/api/content/songs/s-1' ? jsonResponse(sample) : undefined),
    ]);
    const song = await getSong('s-1');
    expect(song.id).toBe('s-1');
    expect(calls).toHaveLength(1);
  });
});

describe('content-client.getStory', () => {
  it('hits the `/api/content/stories/<id>` route', async () => {
    const sample = {
      id: 'story-1',
      title: 'Milo says hi',
      ageBand: '6-8',
      panels: [
        {
          panelId: 'p1',
          imageConcept: 'img.story.miloHello.p1',
          narrationAudio: 'vo.milo.story.miloHello.p1',
          narrationText: 'Hi!',
          duration: 1.5,
        },
      ],
      questions: [],
    };
    const { calls } = installFetch([
      (c) => (c.url === '/api/content/stories/story-1' ? jsonResponse(sample) : undefined),
    ]);
    const story = await getStory('story-1');
    expect(story.id).toBe('story-1');
    expect(calls).toHaveLength(1);
  });
});

describe('content-client.getAudioMap', () => {
  it('returns an empty map when the route 404s (graceful degrade contract)', async () => {
    installFetch([]);
    const map = await getAudioMap('01-me-and-my-world');
    expect(map).toEqual({});
  });

  it('returns an empty map when the schema fails to parse (defensive contract)', async () => {
    installFetch([() => jsonResponse({ bogus: 'shape' })]);
    const map = await getAudioMap('01-me-and-my-world');
    expect(map).toEqual({});
  });
});

describe('content-client.getPhonemeMap', () => {
  it('returns an empty map when the route 404s', async () => {
    installFetch([]);
    const map = await getPhonemeMap('01-me-and-my-world');
    expect(map).toEqual({});
  });

  it('returns the parsed map on success', async () => {
    installFetch([
      (c) =>
        c.url === '/api/content/01-me-and-my-world/phonemes'
          ? jsonResponse({ cat: ['K', 'AE', 'T'], dog: ['D', 'AO', 'G'] })
          : undefined,
    ]);
    const map = await getPhonemeMap('01-me-and-my-world');
    expect(map.cat).toEqual(['K', 'AE', 'T']);
  });
});
