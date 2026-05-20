/**
 * Helpers to validate authored content JSON against the Zod schemas.
 * Throws on invalid input; caller is expected to catch & report.
 */

import { type Unit, UnitSchema } from './schemas';

export function validateUnit(json: unknown): Unit {
  return UnitSchema.parse(json);
}

export function validateAll(units: unknown[]): Unit[] {
  return units.map((u, i) => {
    try {
      return UnitSchema.parse(u);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Unit at index ${i} failed validation: ${msg}`);
    }
  });
}
