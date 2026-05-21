'use client';

/**
 * Mascot voice resolution.
 *
 * Phase 2 introduces Luna as a second mascot. The user-facing setting
 * `mascot.choice` can be `'milo'`, `'luna'`, or `'both'`:
 *
 *  - `'milo'` and `'luna'`: every activity uses that mascot.
 *  - `'both'`: alternation per activity, but **deterministic** for a given
 *    activity id so that the same lesson always shows the same mascot. We
 *    hash the activity id and pick by parity — no `Math.random()`, no
 *    persistence required.
 *
 * Narration assets are authored under namespaced ids (`vo.milo.<key>`,
 * `vo.luna.<key>`). `resolveNarrationAsset` swaps the namespace to match the
 * active mascot, falling back to the original id if the swapped variant is
 * not present in the audio map. That fallback is the contract the audio
 * pipeline relies on while one mascot variant is still being recorded.
 */

import type { AudioAssetMap } from '@e4k/content-schema';
import { getSetting } from '@e4k/db';

export type ActiveMascot = 'milo' | 'luna';
export type MascotChoice = ActiveMascot | 'both';

/**
 * Stable, non-cryptographic 32-bit hash (FNV-1a). Sufficient for the
 * "deterministic alternation" use case; we only need the lowest bit.
 */
function hashStringFnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    // 32-bit FNV prime multiplication, kept inside 32 bits.
    hash = Math.imul(hash, 0x01000193);
  }
  // Mask back to unsigned 32-bit.
  return hash >>> 0;
}

/**
 * Pick the active mascot for the current session / activity.
 *
 * @param activityId Optional activity id. Required only when the setting is
 *   `'both'`, in which case the parity of the hash decides Milo vs. Luna so
 *   that the same activity is always rendered by the same mascot.
 */
export async function getActiveMascot(activityId?: string): Promise<ActiveMascot> {
  const choice = await getSetting<MascotChoice>('mascot.choice', 'milo');
  if (choice === 'milo' || choice === 'luna') return choice;
  // 'both': deterministic per activity. If no activity id is provided, default
  // to Milo so the caller still gets a stable answer for non-activity surfaces
  // (e.g. home screen, settings preview).
  if (!activityId) return 'milo';
  const h = hashStringFnv1a(activityId);
  return (h & 1) === 0 ? 'milo' : 'luna';
}

const MILO_PREFIX = 'vo.milo.';
const LUNA_PREFIX = 'vo.luna.';

/**
 * Resolve a narration asset id to the variant for the active mascot.
 *
 * - Inputs that don't start with either prefix are returned unchanged.
 * - The swap is only applied when the swapped variant is present in
 *   `audioMap`. If not (e.g. authoring hasn't shipped the Luna take yet),
 *   the original id is returned and the audio pipeline plays the existing
 *   variant. The mascot animation can still reflect the user's choice.
 *
 * The `audioMap` argument is optional; when omitted the swap is always
 * attempted and the caller must handle a missing asset themselves. Most
 * callers should pass the map they already have in scope.
 */
export function resolveNarrationAsset(
  audioAssetId: string,
  activeMascot: ActiveMascot,
  audioMap?: AudioAssetMap,
): string {
  let swapped: string | null = null;
  if (audioAssetId.startsWith(MILO_PREFIX) && activeMascot === 'luna') {
    swapped = LUNA_PREFIX + audioAssetId.slice(MILO_PREFIX.length);
  } else if (audioAssetId.startsWith(LUNA_PREFIX) && activeMascot === 'milo') {
    swapped = MILO_PREFIX + audioAssetId.slice(LUNA_PREFIX.length);
  }
  if (swapped === null) return audioAssetId;
  // Honor the fallback contract.
  if (audioMap !== undefined && audioMap[swapped] === undefined) {
    return audioAssetId;
  }
  return swapped;
}

/** Test-only export of the hash. Exposed so the determinism test can pin
 * the expected parity if FNV is ever swapped. */
export const __hashForTests = hashStringFnv1a;
