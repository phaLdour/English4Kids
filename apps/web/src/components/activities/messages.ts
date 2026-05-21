/**
 * Static fallback strings used by activity components.
 *
 * NOTE: Sprint 4 S4-5 migrated UI chrome to next-intl. This module remains for
 * backwards compatibility with code paths that select a random encouragement
 * string (e.g. the lesson player). Each entry below is the EN value; localised
 * copies live in `apps/web/src/locales/<locale>/common.json` under the
 * `activities.*` namespace.
 *
 * Prefer calling `useTranslations()` in components going forward.
 */
export const activityMessages = {
  listenAndTap: {
    aria: 'Listen and tap the matching picture',
    replayPrompt: 'Play the question again',
    soFarGreat: 'Nice listening',
  },
  wordBuilder: {
    aria: 'Build the word',
    wholeWord: 'Tap the word that matches',
    letterSpell: 'Tap each letter in order',
    sentenceChunks: 'Tap each word in order',
    clear: 'Clear',
    confirm: 'Check',
  },
  storyTime: {
    next: 'Next',
    finish: 'Finish story',
    question: 'Story question',
  },
  singAlong: {
    play: 'Play song',
    done: 'Done',
    lyricsLabel: 'Lyrics',
    notReady: 'Song is on the way — sing it your way for now.',
  },
  tprBreak: {
    title: 'Time to move',
    skip: 'I am ready',
  },
  encouragement: ['You got it!', 'Awesome listening!', 'Your brain is growing!'] as const,
  gentle: ["Let's try once more.", 'Listen again.', 'You can do this.'] as const,
} as const;
