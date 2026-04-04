import { config } from '../config.js';
import { noopFraudCheck } from './noop.js';
import { worldIdFraudCheck } from './worldid.js';
import type { FraudCheck } from './types.js';

export { FraudCheck };

export function getFraudCheck(): FraudCheck {
  if (config.worldId.enabled) {
    console.log('[fraud] World ID fraud check enabled');
    return worldIdFraudCheck;
  }
  return noopFraudCheck;
}
