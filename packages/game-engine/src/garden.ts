/**
 * Word garden: maps each Leitner box to a visual growth stage shown to kids
 * and rolls up garden composition for the parent dashboard.
 */

import type { LeitnerBox } from './leitner';

export type GardenStage = 'seed' | 'sprout' | 'bud' | 'bloom' | 'star';

const BOX_TO_STAGE: Record<LeitnerBox, GardenStage> = {
  1: 'seed',
  2: 'sprout',
  3: 'bud',
  4: 'bloom',
  5: 'star',
};

export function wordGardenStage(box: LeitnerBox): GardenStage {
  return BOX_TO_STAGE[box];
}

export interface GardenWord {
  word: string;
  box: LeitnerBox;
}

export type GardenSummary = Record<GardenStage, number>;

/**
 * Roll up a child's vocabulary into garden-stage counts for the parent dashboard.
 */
export function gardenSummary(states: GardenWord[]): GardenSummary {
  const summary: GardenSummary = {
    seed: 0,
    sprout: 0,
    bud: 0,
    bloom: 0,
    star: 0,
  };
  for (const s of states) {
    const stage = BOX_TO_STAGE[s.box];
    summary[stage] += 1;
  }
  return summary;
}
