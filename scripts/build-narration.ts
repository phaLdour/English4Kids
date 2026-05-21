#!/usr/bin/env node
/**
 * build-narration
 *
 * Sprint 4 — S4-1 (Piper narration corpus).
 *
 * Reads every `content/audio-assets/unit-*.json`, walks each entry whose
 * `type === 'narration'` (and song/sfx — see below), and for each one either:
 *
 *   (a) `RENDER_NARRATION=true` is set and the `piper` binary is on PATH —
 *       synthesises real narration via Piper TTS (with a voice selected from
 *       the `voiceActor` field), pipes through `ffmpeg` to produce both an
 *       Opus/Ogg primary file and an MP3 fallback, and records SHA-256 +
 *       byte sizes into `apps/web/public/audio/manifest.json`. This is the
 *       CI / Vercel-build code path.
 *
 *   (b) Default (sandbox / local dev) — emits a **valid 1-second silent
 *       Opus/Ogg + 1-second silent MP3** to the same paths so the lesson
 *       player has decodable audio during development. Files are valid per
 *       `<audio>.canPlay`, will not 404, and play a brief beat where real
 *       narration would go so lesson timing matches production.
 *
 * Both code paths produce the same `manifest.json` schema, so the runtime
 * `verify-audio-manifest.ts` gate works uniformly.
 *
 * Pure Node TS — only stdlib + (optional, at runtime) `piper` + `ffmpeg`.
 * No npm dependencies. Run with:
 *
 *   node --import tsx scripts/build-narration.ts                 # placeholder mode
 *   RENDER_NARRATION=true node --import tsx scripts/build-narration.ts   # full render
 *
 * Outputs:
 *   apps/web/public/audio/<mirroring asset src>.opus  (primary, ~512 B silent)
 *   apps/web/public/audio/<mirroring asset src>.mp3   (fallback, ~104 B silent)
 *   apps/web/public/audio/manifest.json               (integrity + provenance)
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const AUDIO_ASSETS_DIR = join(ROOT, 'content', 'audio-assets');
const LEXICON_PATH = join(AUDIO_ASSETS_DIR, 'lexicon-overrides.json');
const OUT_ROOT = join(ROOT, 'apps', 'web', 'public', 'audio');
const MANIFEST_PATH = join(OUT_ROOT, 'manifest.json');

interface AssetEntry {
  src: string;
  voiceActor?: string;
  lang: string;
  durationSec: number;
  transcript: string;
  type: 'narration' | 'song' | 'sfx' | string;
  license: string;
}
type AssetMap = Record<string, AssetEntry>;

interface ManifestEntry {
  id: string;
  unit: string;
  srcOpus: string;
  srcMp3: string;
  opusBytes: number;
  mp3Bytes: number;
  opusSha256: string;
  mp3Sha256: string;
  transcript: string;
  voice: string;
  type: string;
  renderedWith: 'piper' | 'placeholder';
  builtAt: string;
}

// ---------------------------------------------------------------------------
// Placeholder audio constructors
// ---------------------------------------------------------------------------

/**
 * Build a minimal valid 1-second mono 16 kHz silent Opus stream wrapped in
 * Ogg. The result is a 3-page Ogg container:
 *
 *   Page 1 (BOS): OpusHead identification packet (19 bytes payload).
 *   Page 2:       OpusTags comment header (variable, ~36 bytes).
 *   Page 3 (EOS): 50 × 20ms silent SILK packets (CELT-only TOC) carrying a
 *                 single-byte payload each — 50 * 1 = 50 bytes — yielding
 *                 exactly 1.000 s of decodable silence.
 *
 * Per RFC 7845, OpusHead version=1, channels=1, pre-skip=0, input_rate=16000,
 * gain=0, channel_mapping=0. Pre-skip=0 keeps the math simple for a
 * placeholder; production renders from Piper will set the proper 312 sample
 * pre-skip from the encoder.
 *
 * Each Ogg page has a CRC32 (poly 0x04c11db7, init=0, no reflect, no xorout)
 * computed over the page bytes with the CRC field itself zeroed.
 */
function buildSilentOpus(): Uint8Array {
  // ----- OpusHead packet -----
  const head = new Uint8Array(19);
  head.set([0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64], 0); // "OpusHead"
  head[8] = 1; // version
  head[9] = 1; // channel count (mono)
  // pre-skip = 0 (LE u16)
  head[10] = 0;
  head[11] = 0;
  // input sample rate = 16000 Hz (LE u32) — informational only
  head[12] = 0x80;
  head[13] = 0x3e;
  head[14] = 0x00;
  head[15] = 0x00;
  // output gain = 0 (LE i16)
  head[16] = 0;
  head[17] = 0;
  // channel mapping family = 0 (RTP mono/stereo, no mapping table follows)
  head[18] = 0;

  // ----- OpusTags packet -----
  const vendor = 'e4k-placeholder';
  const vendorBytes = new TextEncoder().encode(vendor);
  const tags = new Uint8Array(8 + 4 + vendorBytes.length + 4);
  tags.set([0x4f, 0x70, 0x75, 0x73, 0x54, 0x61, 0x67, 0x73], 0); // "OpusTags"
  // vendor length (LE u32)
  const dvT = new DataView(tags.buffer);
  dvT.setUint32(8, vendorBytes.length, true);
  tags.set(vendorBytes, 12);
  // user comment list length = 0
  dvT.setUint32(12 + vendorBytes.length, 0, true);

  // ----- 50 silent audio packets, 20ms each (1 second total) -----
  // Opus TOC byte 0x78 == config 15 (SILK-WB 20ms), stereo=0, frames code 0.
  // A single byte 0x78 is technically a frame-less packet; the decoder treats
  // any payload as silence when length == 1. We use a 2-byte packet
  // [0x78, 0x00] to be unambiguous: TOC + 1 byte of LBRR-free silent SILK.
  const SILENT_PACKET = new Uint8Array([0x78, 0x00]);
  const N_PACKETS = 50;

  // Concatenate all audio packets into one payload for the EOS page.
  const audioPayload = new Uint8Array(N_PACKETS * SILENT_PACKET.length);
  for (let i = 0; i < N_PACKETS; i++) {
    audioPayload.set(SILENT_PACKET, i * SILENT_PACKET.length);
  }
  // Each packet is 2 bytes so its lacing value is 2; we need N_PACKETS lacing
  // segments of value 2. Ogg lacing values < 255 terminate a packet, so 50
  // segments of 0x02 cleanly delimit 50 individual packets.
  const audioSegments = new Uint8Array(N_PACKETS).fill(SILENT_PACKET.length);

  const headPage = buildOggPage({
    granulePosition: 0n,
    serial: 0xe4ade4ad,
    pageSequence: 0,
    headerType: 0x02, // BOS
    segments: [head], // single packet, fits in one segment of length 19
  });
  const tagsPage = buildOggPage({
    granulePosition: 0n,
    serial: 0xe4ade4ad,
    pageSequence: 1,
    headerType: 0x00,
    segments: [tags],
  });
  const audioPage = buildOggPageRaw({
    granulePosition: BigInt(48000), // 1 second at 48 kHz Opus internal rate
    serial: 0xe4ade4ad,
    pageSequence: 2,
    headerType: 0x04, // EOS
    laceTable: audioSegments,
    payload: audioPayload,
  });

  return concatBytes([headPage, tagsPage, audioPage]);
}

/**
 * Build a single Ogg page where every "segment" is one complete packet that
 * fits in fewer than 255 bytes. Each segment becomes one lacing entry equal
 * to its length followed by a terminator entry of 0 for packets exactly
 * divisible by 255 — but since all our placeholder packets are tiny we can
 * use the simpler raw form for the audio page above.
 */
function buildOggPage(opts: {
  granulePosition: bigint;
  serial: number;
  pageSequence: number;
  headerType: number;
  segments: Uint8Array[];
}): Uint8Array {
  // Build lacing table: for each packet, emit ceil(len/255) entries of 255
  // followed by len%255 (which may be 0 if len is a multiple of 255).
  const laceEntries: number[] = [];
  for (const seg of opts.segments) {
    let remaining = seg.length;
    while (remaining >= 255) {
      laceEntries.push(255);
      remaining -= 255;
    }
    laceEntries.push(remaining);
  }
  const lace = new Uint8Array(laceEntries);
  const payload = concatBytes(opts.segments);
  return buildOggPageRaw({
    granulePosition: opts.granulePosition,
    serial: opts.serial,
    pageSequence: opts.pageSequence,
    headerType: opts.headerType,
    laceTable: lace,
    payload,
  });
}

function buildOggPageRaw(opts: {
  granulePosition: bigint;
  serial: number;
  pageSequence: number;
  headerType: number;
  laceTable: Uint8Array;
  payload: Uint8Array;
}): Uint8Array {
  const headerLen = 27 + opts.laceTable.length;
  const page = new Uint8Array(headerLen + opts.payload.length);
  const dv = new DataView(page.buffer);
  // "OggS"
  page.set([0x4f, 0x67, 0x67, 0x53], 0);
  page[4] = 0; // stream structure version
  page[5] = opts.headerType;
  dv.setBigUint64(6, opts.granulePosition, true);
  dv.setUint32(14, opts.serial >>> 0, true);
  dv.setUint32(18, opts.pageSequence >>> 0, true);
  dv.setUint32(22, 0, true); // CRC placeholder (computed below)
  page[26] = opts.laceTable.length;
  page.set(opts.laceTable, 27);
  page.set(opts.payload, headerLen);

  const crc = oggCrc32(page);
  dv.setUint32(22, crc >>> 0, true);
  return page;
}

/** Ogg's CRC32: poly 0x04c11db7, init 0, no input/output reflection, no xorout. */
function oggCrc32(data: Uint8Array): number {
  const TABLE = OGG_CRC_TABLE;
  let crc = 0;
  for (let i = 0; i < data.length; i++) {
    const byte = data[i] as number;
    crc = ((crc << 8) ^ (TABLE[((crc >>> 24) ^ byte) & 0xff] as number)) >>> 0;
  }
  return crc >>> 0;
}

const OGG_CRC_TABLE: number[] = (() => {
  const t = new Array<number>(256);
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let j = 0; j < 8; j++) {
      r = (r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1) >>> 0;
    }
    t[i] = r >>> 0;
  }
  return t;
})();

/**
 * Build a 1-second silent MP3 (MPEG-1 Layer III, mono, 32 kbps, 44.1 kHz).
 *
 * Each frame:
 *   Header (4 bytes): FF FB 10 C4
 *     0xFF       = sync 11111111
 *     0xFB       = 11111011 = sync-tail(111) + MPEG1(11) + LayerIII(01) + no-CRC(1)
 *     0x10       = 00010000 = bitrate=32kbps(0001) + samplerate=44.1kHz(00)
 *                  + padding(0) + private(0)
 *     0xC4       = 11000100 = channel=mono(11) + modeExt(00) + copyright(0)
 *                  + original(1) + emphasis(00)
 *   Side info (17 bytes for mono L3) + main_data (zeros) = 100 bytes
 * Frame size = floor(144 * 32000 / 44100) = 104 bytes.
 *
 * A frame of all-zero main_data following the standard mono side-info layout
 * decodes as silence in libmpg123, lavf, and Apple CoreAudio. Frame duration
 * = 1152 / 44100 s ≈ 26.122 ms. 38 frames ≈ 992 ms — close enough to "1
 * second" for placeholder timing.
 */
function buildSilentMp3(): Uint8Array {
  const FRAME_SIZE = 104;
  const N_FRAMES = 38;
  const frame = new Uint8Array(FRAME_SIZE);
  frame[0] = 0xff;
  frame[1] = 0xfb;
  frame[2] = 0x10;
  frame[3] = 0xc4;
  // side info + main data zeroed already by Uint8Array default.
  const out = new Uint8Array(FRAME_SIZE * N_FRAMES);
  for (let i = 0; i < N_FRAMES; i++) {
    out.set(frame, i * FRAME_SIZE);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function concatBytes(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function pickVoiceModel(voiceActor: string | undefined): {
  model: string;
  speaker: 'milo' | 'luna' | 'mascot';
} {
  if (!voiceActor) return { model: 'en_US-amy-medium.onnx', speaker: 'mascot' };
  if (/jenny_dioco/i.test(voiceActor) || /^Luna/i.test(voiceActor)) {
    return { model: 'en_GB-jenny_dioco-medium.onnx', speaker: 'luna' };
  }
  return { model: 'en_US-amy-medium.onnx', speaker: 'milo' };
}

function unitOfPath(srcPath: string): string {
  const m = srcPath.match(/\/audio\/vo\/u(\d+)\//);
  if (m) return `u${m[1]}`;
  if (srcPath.startsWith('/audio/vo/story/')) return 'story';
  if (srcPath.startsWith('/audio/mus/')) return 'mus';
  if (srcPath.startsWith('/audio/fx/')) return 'fx';
  return 'misc';
}

function isPiperAvailable(): boolean {
  const r = spawnSync('which', ['piper'], { encoding: 'utf8' });
  return r.status === 0 && Boolean(r.stdout.trim());
}

function isFfmpegAvailable(): boolean {
  const r = spawnSync('which', ['ffmpeg'], { encoding: 'utf8' });
  return r.status === 0 && Boolean(r.stdout.trim());
}

// ---------------------------------------------------------------------------
// Piper render (CI / production)
// ---------------------------------------------------------------------------

function renderWithPiper(
  transcript: string,
  outOpusPath: string,
  outMp3Path: string,
  voiceModel: string,
): { opus: Uint8Array; mp3: Uint8Array } {
  const lexiconArgs = existsSync(LEXICON_PATH)
    ? ['--phoneme_id_map_path', LEXICON_PATH]
    : [];

  const piperArgs = [
    '--model',
    voiceModel,
    '--output_file',
    outOpusPath,
    ...lexiconArgs,
  ];

  const piper = spawnSync('piper', piperArgs, {
    input: transcript,
    encoding: 'buffer',
  });
  if (piper.status !== 0) {
    throw new Error(
      `piper failed (${piper.status}): ${piper.stderr?.toString() ?? '<no stderr>'}`,
    );
  }

  // Convert Piper's default wav-ish output to Opus + MP3 via ffmpeg.
  // (Piper writes WAV when --output_file ends .wav; we'll convert to .opus
  // and a separate .mp3.)
  const tmpWav = `${outOpusPath}.tmp.wav`;
  const renameMv = spawnSync('mv', [outOpusPath, tmpWav]);
  if (renameMv.status !== 0) {
    throw new Error('rename to tmp.wav failed');
  }

  const ffOpus = spawnSync('ffmpeg', [
    '-y',
    '-i',
    tmpWav,
    '-c:a',
    'libopus',
    '-b:a',
    '24k',
    '-application',
    'voip',
    outOpusPath,
  ]);
  if (ffOpus.status !== 0) {
    throw new Error('ffmpeg opus encode failed');
  }
  const ffMp3 = spawnSync('ffmpeg', [
    '-y',
    '-i',
    tmpWav,
    '-codec:a',
    'libmp3lame',
    '-q:a',
    '4',
    outMp3Path,
  ]);
  if (ffMp3.status !== 0) {
    throw new Error('ffmpeg mp3 encode failed');
  }
  spawnSync('rm', ['-f', tmpWav]);

  return {
    opus: readFileSync(outOpusPath),
    mp3: readFileSync(outMp3Path),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const renderRequested = process.env.RENDER_NARRATION === 'true';
  const piperReady = isPiperAvailable() && isFfmpegAvailable();
  const mode: 'piper' | 'placeholder' = renderRequested && piperReady ? 'piper' : 'placeholder';

  if (renderRequested && !piperReady) {
    console.warn(
      '[build-narration] RENDER_NARRATION=true requested but piper/ffmpeg not on PATH. Falling back to placeholders.',
    );
  }
  console.log(`[build-narration] mode = ${mode}`);

  const silentOpus = buildSilentOpus();
  const silentMp3 = buildSilentMp3();
  console.log(
    `[build-narration] placeholder templates: opus=${silentOpus.length}B mp3=${silentMp3.length}B`,
  );

  const manifestEntries: ManifestEntry[] = [];
  let totalAssets = 0;
  let totalPlaceholders = 0;
  let totalRendered = 0;

  for (const fname of readdirSync(AUDIO_ASSETS_DIR)) {
    if (!fname.startsWith('unit-') || !fname.endsWith('.json')) continue;
    const unitPath = join(AUDIO_ASSETS_DIR, fname);
    const map = JSON.parse(readFileSync(unitPath, 'utf8')) as AssetMap;
    const unitTag = fname.replace(/\.json$/, '');

    for (const [id, entry] of Object.entries(map)) {
      totalAssets += 1;
      // Strip leading slash to get FS-relative
      const srcRel = entry.src.replace(/^\//, '');
      const baseFsPath = join(ROOT, 'apps', 'web', 'public', srcRel);
      const dir = dirname(baseFsPath);
      mkdirSync(dir, { recursive: true });

      // The src in JSON is the .mp3 path; we always emit a sibling .opus too.
      const mp3Path = baseFsPath;
      const opusPath = baseFsPath.replace(/\.mp3$/, '.opus');

      let opusBytes: Uint8Array;
      let mp3Bytes: Uint8Array;
      let renderedWith: 'piper' | 'placeholder' = 'placeholder';

      if (mode === 'piper' && entry.type === 'narration') {
        const { model } = pickVoiceModel(entry.voiceActor);
        try {
          const out = renderWithPiper(entry.transcript, opusPath, mp3Path, model);
          opusBytes = out.opus;
          mp3Bytes = out.mp3;
          renderedWith = 'piper';
          totalRendered += 1;
        } catch (err) {
          console.warn(
            `[build-narration] piper failed for ${id} (${(err as Error).message}); writing placeholder`,
          );
          opusBytes = silentOpus;
          mp3Bytes = silentMp3;
          writeFileSync(opusPath, opusBytes);
          writeFileSync(mp3Path, mp3Bytes);
          totalPlaceholders += 1;
        }
      } else {
        opusBytes = silentOpus;
        mp3Bytes = silentMp3;
        writeFileSync(opusPath, opusBytes);
        writeFileSync(mp3Path, mp3Bytes);
        totalPlaceholders += 1;
      }

      manifestEntries.push({
        id,
        unit: unitTag,
        srcOpus: entry.src.replace(/\.mp3$/, '.opus'),
        srcMp3: entry.src,
        opusBytes: opusBytes.length,
        mp3Bytes: mp3Bytes.length,
        opusSha256: sha256Hex(opusBytes),
        mp3Sha256: sha256Hex(mp3Bytes),
        transcript: entry.transcript,
        voice: entry.voiceActor ?? '(sfx)',
        type: entry.type,
        renderedWith,
        builtAt: new Date().toISOString(),
      });
    }
  }

  // Sort for deterministic diffs.
  manifestEntries.sort((a, b) => a.id.localeCompare(b.id));
  mkdirSync(OUT_ROOT, { recursive: true });
  writeFileSync(
    MANIFEST_PATH,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        mode,
        totals: {
          assets: totalAssets,
          renderedByPiper: totalRendered,
          placeholders: totalPlaceholders,
        },
        entries: manifestEntries,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  console.log(
    `[build-narration] wrote ${manifestEntries.length} entries to ${MANIFEST_PATH}`,
  );
  console.log(
    `[build-narration] totals: assets=${totalAssets} piper=${totalRendered} placeholder=${totalPlaceholders}`,
  );
}

main();
