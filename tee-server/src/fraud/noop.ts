import type { FraudCheck } from './types.js';

/**
 * No-op fraud check — used when WORLD_ID_ENABLED=false.
 * All requests pass through. Safe to use in development.
 */
export const noopFraudCheck: FraudCheck = {
  async check() {
    // No-op: allow all requests
  },
  async ban(_nullifierHash: string, _reason: string) {
    // No-op: banning not supported without World ID
    console.warn('[fraud] Ban called but WORLD_ID_ENABLED=false — no effect');
  },
};
