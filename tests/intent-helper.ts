import { test as viTest } from 'vitest';

/**
 * CSD Intent test decorator for Vitest.
 * Registers a test named with the intent claim ID so csd-intent scanner links it.
 */
export function intent(claimId: string | string[], name: string, fn: () => void | Promise<void>) {
  const ids = Array.isArray(claimId) ? claimId.join(', ') : claimId;
  return viTest(`[${ids}] - ${name}`, fn);
}
