'use client';

import type { LeitnerBox } from '@e4k/game-engine';
import { useTranslations } from 'next-intl';
import { WordPlant } from './WordPlant';

export interface WordGardenState {
  word: string;
  box: LeitnerBox;
  lastPracticedAt?: Date | null;
}

export interface WordGardenProps {
  states: WordGardenState[];
  view?: 'visual' | 'list';
  onPlantTap?: (word: string) => void;
}

/**
 * The Word Garden visualizes a child's spaced-repetition state as a living
 * garden. Each word is a plant that grows seed → sprout → bud → bloom → star
 * as the Leitner box advances. Box-5 ("mastered") words rise to the night-sky
 * band at the top so progress feels durable.
 *
 * `view='list'` renders a read-only grid suited to the parent dashboard.
 */
export function WordGarden({ states, view = 'visual', onPlantTap }: WordGardenProps) {
  const t = useTranslations();
  if (view === 'list') {
    return <WordGardenList states={states} />;
  }

  const stars = states.filter((s) => s.box === 5);
  const growing = states.filter((s) => s.box !== 5);

  return (
    <section
      aria-label={t('garden.ariaLabel')}
      data-view="visual"
      className="flex w-full max-w-3xl flex-col gap-[var(--space-4)] rounded-[var(--radius-lg)] bg-[var(--color-surface-high)] p-[var(--space-5)] shadow-[var(--shadow-card)]"
    >
      <div
        aria-label={t('garden.ariaMastered')}
        className="flex min-h-[88px] w-full flex-wrap items-center justify-center gap-[var(--space-2)] rounded-[var(--radius-md)] bg-[var(--color-surface)] p-[var(--space-3)]"
        style={{ borderBottom: '1px dashed var(--color-muted)' }}
      >
        {stars.length === 0 ? (
          <p
            className="text-sm text-[var(--color-mist)]"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {t('garden.masteredPlaceholder')}
          </p>
        ) : (
          stars.map((s) => (
            <WordPlant
              key={`star-${s.word}`}
              word={s.word}
              box={s.box}
              size={72}
              onTap={onPlantTap}
            />
          ))
        )}
      </div>
      <div
        aria-label={t('garden.ariaGrowing')}
        className="grid w-full gap-[var(--space-3)]"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))' }}
      >
        {growing.length === 0 ? (
          <p
            className="col-span-full text-center text-base text-[var(--color-mist)]"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {t('garden.growingPlaceholder')}
          </p>
        ) : (
          growing.map((s) => (
            <WordPlant
              key={`plant-${s.word}`}
              word={s.word}
              box={s.box}
              size={96}
              onTap={onPlantTap}
            />
          ))
        )}
      </div>
    </section>
  );
}

function WordGardenList({ states }: { states: WordGardenState[] }) {
  const t = useTranslations();
  const stageName: Record<LeitnerBox, string> = {
    1: t('garden.stageSeed'),
    2: t('garden.stageSprout'),
    3: t('garden.stageBud'),
    4: t('garden.stageBloom'),
    5: t('garden.stageStar'),
  };
  return (
    <section
      aria-label={t('garden.ariaLabelList')}
      data-view="list"
      className="flex w-full max-w-3xl flex-col gap-[var(--space-3)] rounded-[var(--radius-lg)] bg-[var(--color-surface-high)] p-[var(--space-5)] shadow-[var(--shadow-card)]"
    >
      <table
        className="w-full text-left text-base text-[var(--color-ink)]"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        <thead>
          <tr
            className="border-b border-[var(--color-muted)] text-sm text-[var(--color-mist)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <th scope="col" className="py-[var(--space-2)]">
              {t('garden.colWord')}
            </th>
            <th scope="col" className="py-[var(--space-2)]">
              {t('garden.colStage')}
            </th>
            <th scope="col" className="py-[var(--space-2)]">
              {t('garden.colLastPractice')}
            </th>
          </tr>
        </thead>
        <tbody>
          {states.length === 0 ? (
            <tr>
              <td
                colSpan={3}
                className="py-[var(--space-3)] text-center text-[var(--color-mist)]"
              >
                {t('garden.noWords')}
              </td>
            </tr>
          ) : (
            states.map((s) => (
              <tr key={`row-${s.word}`}>
                <td className="py-[var(--space-2)]">{s.word}</td>
                <td className="py-[var(--space-2)]">{stageName[s.box]}</td>
                <td className="py-[var(--space-2)]">
                  {s.lastPracticedAt ? s.lastPracticedAt.toLocaleDateString() : '—'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
