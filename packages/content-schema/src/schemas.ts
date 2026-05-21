/**
 * Zod content schemas for English4Kids.
 *
 * Schemas validate authored JSON content at build time (via the validator CLI)
 * and at runtime when ingesting remote content packs.
 */

import { z } from 'zod';

// ---------- Shared enums ----------

export const AgeBandSchema = z.enum(['6-8', '9-12']);
export type AgeBand = z.infer<typeof AgeBandSchema>;

export const CefrSchema = z.enum(['Pre-A1', 'A1', 'A2']);
export type Cefr = z.infer<typeof CefrSchema>;

export const PosSchema = z.enum(['n', 'v', 'adj', 'adv', 'interj', 'num', 'chunk']);
export type Pos = z.infer<typeof PosSchema>;

// ---------- Vocabulary ----------

export const VocabEntrySchema = z.object({
  id: z.string(),
  word: z.string(),
  pos: PosSchema,
  semCategory: z.string(),
  imageConceptId: z.string(),
  exampleChunk: z.string(),
  /** Address of first introduction, e.g. 'u1.l1.a1'. */
  firstIntroduced: z.string(),
  cefrDescriptor: z.string(),
  /** Precomputed CMU phonemes for pronunciation scoring. */
  phonemes: z.array(z.string()).optional(),
});
export type VocabEntry = z.infer<typeof VocabEntrySchema>;

// ---------- Activity items (discriminated union by `type`) ----------

export const ActivityTypeSchema = z.enum([
  'listen_tap',
  'word_builder',
  'speak_it',
  'story_time',
  'sing_along',
]);
export type ActivityType = z.infer<typeof ActivityTypeSchema>;

export const ListenTapItemSchema = z.object({
  id: z.string(),
  type: z.literal('listen_tap'),
  ageBand: AgeBandSchema,
  promptAudio: z.string(),
  promptTranscript: z.string(),
  options: z
    .array(
      z.object({
        imageConcept: z.string(),
        isCorrect: z.boolean(),
      }),
    )
    .min(2)
    .max(4),
  distractorRationale: z.string().optional(),
});
export type ListenTapItem = z.infer<typeof ListenTapItemSchema>;

/**
 * `word_builder` activity item.
 *
 * Three variants the renderer dispatches on:
 *  - `whole_word_drag` (6-8): `options` is a 2-entry list of whole words; kid taps the correct one.
 *  - `letter_spell` (9-12): `letterPool` is single-character tiles; kid arranges them into `targetWord`.
 *  - `sentence_chunks` (9-12): `letterPool` is multi-character word tokens; kid arranges them in
 *    `targetWord` order, joined by single spaces. Added in Sprint 3 for u3.l4 sentence assembly
 *    ("a bird can fly", "a fish can swim", etc.). See ADR 0005 addendum.
 *
 * The cross-field consistency rule (single-char tiles for `letter_spell`, full token coverage
 * for `sentence_chunks`) is enforced by `refineWordBuilderItem` below — applied as a refinement
 * on the wrapping union/Unit schemas so that `WordBuilderItemSchema` itself remains a plain
 * `ZodObject` and can participate in `discriminatedUnion('type', …)`.
 */
export const WordBuilderItemSchema = z.object({
  id: z.string(),
  type: z.literal('word_builder'),
  ageBand: AgeBandSchema,
  variant: z.enum(['whole_word_drag', 'letter_spell', 'sentence_chunks']),
  targetWord: z.string(),
  targetImage: z.string().optional(),
  letterPool: z.array(z.string()).optional(),
  options: z.array(z.string()).optional(),
  correctIndex: z.number().optional(),
  promptAudio: z.string(),
  promptTranscript: z.string(),
  hintAudio: z.string().optional(),
  hintTranscript: z.string().optional(),
});
export type WordBuilderItem = z.infer<typeof WordBuilderItemSchema>;

/**
 * Cross-field validation for a word_builder item. Returns the list of issues
 * (empty array if the item is consistent). Exported so the validate-content CLI
 * and the runtime `UnitSchema` refinement can share one source of truth.
 *
 * Catches the Critic Wave-2 S0-1 regression: a `letter_spell` item whose
 * `letterPool` contains multi-char tokens crashes the renderer at runtime.
 */
export function checkWordBuilderConsistency(item: WordBuilderItem): string[] {
  const issues: string[] = [];
  if (item.variant === 'letter_spell') {
    const pool = item.letterPool ?? [];
    const multiChar = pool.filter((tok) => tok.length > 1 && !tok.includes(' '));
    if (multiChar.length > 0) {
      issues.push(
        `letter_spell letterPool must contain single characters only; got multi-char tokens [${multiChar.join(', ')}] — use variant 'sentence_chunks' instead.`,
      );
    }
  }
  if (item.variant === 'sentence_chunks') {
    const pool = item.letterPool ?? [];
    if (pool.length === 0) {
      issues.push(`sentence_chunks requires a non-empty letterPool of word tokens.`);
    }
    const expected = item.targetWord.trim().split(/\s+/);
    for (const token of expected) {
      if (!pool.includes(token)) {
        issues.push(
          `sentence_chunks letterPool is missing target token "${token}" required to spell "${item.targetWord}".`,
        );
      }
    }
  }
  if (item.variant === 'whole_word_drag') {
    const options = item.options ?? [];
    if (options.length < 2) {
      issues.push(`whole_word_drag requires at least 2 options.`);
    }
    if (item.correctIndex === undefined) {
      issues.push(`whole_word_drag requires a correctIndex.`);
    }
  }
  return issues;
}

export const SpeakItItemSchema = z.object({
  id: z.string(),
  type: z.literal('speak_it'),
  ageBand: AgeBandSchema,
  targetUtterance: z.string(),
  promptAudio: z.string(),
  promptTranscript: z.string(),
  attempts: z.number().int().positive().default(3),
  /** 0..1 confidence threshold from scorer; UI never shows red. */
  scoreThreshold: z.number().min(0).max(1),
  encouragementSet: z.array(z.string()),
});
export type SpeakItItem = z.infer<typeof SpeakItItemSchema>;

export const StoryPanelSchema = z.object({
  panelId: z.string(),
  imageConcept: z.string(),
  narrationAudio: z.string(),
  narrationText: z.string(),
  karaokeHighlights: z
    .array(
      z.object({
        wordStart: z.number(),
        wordEnd: z.number(),
        vocabRef: z.string().optional(),
      }),
    )
    .default([]),
  duration: z.number().positive(),
});
export type StoryPanel = z.infer<typeof StoryPanelSchema>;

export const StoryQuestionSchema = z.object({
  id: z.string(),
  type: z.literal('story_question'),
  questionType: z.enum(['multiple_choice', 'sequencing']),
  ageBand: AgeBandSchema,
  promptAudio: z.string(),
  promptTranscript: z.string(),
  items: z.array(z.string()),
  correctIndex: z.number().int().nonnegative().optional(),
  correctOrder: z.array(z.number()).optional(),
});
export type StoryQuestion = z.infer<typeof StoryQuestionSchema>;

export const StoryTimeItemSchema = z.object({
  id: z.string(),
  type: z.literal('story_time'),
  ageBand: AgeBandSchema,
  storyId: z.string(),
  panels: z.array(StoryPanelSchema),
  questions: z.array(StoryQuestionSchema),
});
export type StoryTimeItem = z.infer<typeof StoryTimeItemSchema>;

export const SingAlongItemSchema = z.object({
  id: z.string(),
  type: z.literal('sing_along'),
  ageBand: AgeBandSchema,
  songId: z.string(),
});
export type SingAlongItem = z.infer<typeof SingAlongItemSchema>;

export const ActivityItemSchema = z.discriminatedUnion('type', [
  ListenTapItemSchema,
  WordBuilderItemSchema,
  SpeakItItemSchema,
  StoryTimeItemSchema,
  SingAlongItemSchema,
]);
export type ActivityItem = z.infer<typeof ActivityItemSchema>;

// ---------- Activity / lesson / unit ----------

export const ActivitySchema = z.object({
  id: z.string(),
  type: ActivityTypeSchema,
  title: z.string(),
  items: z.array(ActivityItemSchema),
});
export type Activity = z.infer<typeof ActivitySchema>;

export const LessonSchema = z.object({
  id: z.string(),
  title: z.string(),
  miniTheme: z.string(),
  orderIndex: z.number().int(),
  vocabRefs: z.array(z.string()),
  songRef: z.string().optional(),
  storyRef: z.string().optional(),
  activities: z.array(ActivitySchema),
  tprBreak: z
    .object({
      afterActivityIndex: z.number().int(),
      durationSec: z.number().positive(),
      promptText: z.string(),
    })
    .optional(),
});
export type Lesson = z.infer<typeof LessonSchema>;

export const UnitSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    theme: z.string(),
    cefr: CefrSchema,
    orderIndex: z.number().int(),
    lessons: z.array(LessonSchema),
  })
  .superRefine((unit, ctx) => {
    for (let li = 0; li < unit.lessons.length; li++) {
      const lesson = unit.lessons[li];
      if (!lesson) continue;
      for (let ai = 0; ai < lesson.activities.length; ai++) {
        const activity = lesson.activities[ai];
        if (!activity) continue;
        for (let ii = 0; ii < activity.items.length; ii++) {
          const item = activity.items[ii];
          if (!item || item.type !== 'word_builder') continue;
          const issues = checkWordBuilderConsistency(item);
          for (const message of issues) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['lessons', li, 'activities', ai, 'items', ii],
              message: `[${item.id}] ${message}`,
            });
          }
        }
      }
    }
  });
export type Unit = z.infer<typeof UnitSchema>;

// ---------- Songs ----------

export const SongLyricSchema = z.object({
  id: z.string(),
  title: z.string(),
  /** LRC format with timestamps. */
  lrc: z.string(),
  audioRef: z.string(),
  targetVocabRefs: z.array(z.string()),
  tprMoves: z
    .array(
      z.object({
        ageBand: AgeBandSchema,
        move: z.string(),
        cueTime: z.number().nonnegative(),
      }),
    )
    .default([]),
});
export type SongLyric = z.infer<typeof SongLyricSchema>;

// ---------- Audio asset registry ----------

export const LicenseSchema = z.enum([
  'CC0',
  'CC-BY',
  'MIT',
  'Apache-2.0',
  'BSD-2',
  'BSD-3',
  'OFL',
  'Original-MIT',
]);
export type License = z.infer<typeof LicenseSchema>;

export const AudioAssetMapSchema = z.record(
  z.string(),
  z.object({
    src: z.string(),
    voiceActor: z.string().optional(),
    lang: z.string().default('en-US'),
    durationSec: z.number().positive(),
    transcript: z.string(),
    type: z.enum(['narration', 'song', 'sfx', 'music']),
    license: LicenseSchema,
  }),
);
export type AudioAssetMap = z.infer<typeof AudioAssetMapSchema>;
