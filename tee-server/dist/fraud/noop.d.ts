import type { FraudCheck } from './types.js';
/**
 * No-op fraud check — used when WORLD_ID_ENABLED=false.
 * All requests pass through. Safe to use in development.
 */
export declare const noopFraudCheck: FraudCheck;
