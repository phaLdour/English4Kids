# Music Strategy

## Licensing

- **CC0 or CC-BY only** for any sourced track.
- **Original-MIT** for compositions written for the project.
- No CC-NC, no CC-ND, no "royalty-free" without an explicit, attributable license.
- Every track entered in `PROVENANCE.md` with file, source, author, license, and date.

## Sonic palette

- Acoustic-folk + ukulele + marimba + soft hand-percussion as the core.
- Sparse use of soft pads and Rhodes for transitions.
- Avoid: dense electronic drums, distorted guitars, dubstep wobbles, aggressive sub-bass.
- Tempo range: 78–110 BPM for menu/BGM; 100–130 BPM for songs; never above 140.

## Loudness

- Music BGM mastered to **-16 LUFS integrated**, true peak **-1 dBTP**.
- Songs (Sing Along) mastered to **-14 LUFS integrated** so they sit above BGM defaults.

## Formats

- Primary: **opus** at ~96 kbps VBR (music), ~128 kbps VBR (songs).
- Fallback: **mp3** at 192 kbps for songs, 160 kbps for BGM.
- Stems for songs (vocal-only and instrumental-only) shipped behind a feature flag for karaoke mode (Phase 2).

## Looping

- BGM loops are seamless (cross-fade or sample-accurate loop point in opus).
- Each BGM track has a defined `loopStart` / `loopEnd` in the audio map for Howler.

## MVP track list (3 songs total — ADR 0006)

| Slot | Working title | Style | Used in |
|---|---|---|---|
| Song 1 | *Hello Friend* | uke + claps, 100 BPM | u1/l1/sing-along |
| Song 2 | *Count With Me* | marimba + light bass, 105 BPM | u2 numbers |
| Song 3 | *Colors Around* | acoustic guitar + glockenspiel, 95 BPM | u3 colors |

Songs 4 and 5 originally planned are deferred to Phase 2.

## Ducking

- BGM ducks **-6 dB** under narration, **-3 dB** under SFX.
- BGM pauses entirely during Sing Along (the song takes the channel).
