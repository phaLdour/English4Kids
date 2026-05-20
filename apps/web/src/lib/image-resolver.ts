/**
 * Resolve a content imageConcept (e.g. "characters/milo") to a public URL.
 * In Sprint 2 we look under /content-images/<concept>.svg; missing files
 * gracefully fall back to undefined (TapCard renders an initial letter).
 */
export function resolveImage(imageConcept: string): string | undefined {
  if (!imageConcept) return undefined;
  return `/content-images/${imageConcept}.svg`;
}
