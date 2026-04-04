import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import type { FraudCheck } from './types.js';

/**
 * World ID fraud check — verifies ZKP proof and checks nullifier ban list.
 *
 * TODO: Not yet implemented — waiting on World ID device + app registration.
 * The interface is scaffolded so this can be dropped in with zero changes to
 * the card issuance route.
 *
 * When WORLD_ID_ENABLED=true this will:
 * 1. Verify the World ID ZK proof against the World ID contract
 * 2. Check if the resulting nullifier_hash is in the Supabase bans table
 * 3. Throw if banned or proof invalid
 */

const supabase = createSupabaseClient(
  config.supabase.url,
  config.supabase.serviceRoleKey
);

export const worldIdFraudCheck: FraudCheck = {
  async check(nullifierHash?: string, _worldIdProof?: unknown): Promise<void> {
    if (!nullifierHash) {
      throw new Error('World ID is required: missing nullifier_hash');
    }

    // TODO: verify ZK proof with @worldcoin/minikit-js before checking ban list
    // const verified = await verifyCloudProof(worldIdProof, config.worldId.appId, config.worldId.action);
    // if (!verified.success) throw new Error('World ID proof invalid');

    // Check ban list in Supabase
    const { data, error } = await supabase
      .from('bans')
      .select('nullifier_hash')
      .eq('nullifier_hash', nullifierHash)
      .maybeSingle();

    if (error) {
      // If DB is unavailable, fail open (allow) to avoid blocking legitimate users
      // Change to fail closed by throwing here if security > availability
      console.warn('[fraud] Ban check DB unavailable — allowing (fail open):', error.message);
      return;
    }
    if (data) throw new Error('User is banned from card issuance');
  },

  async ban(nullifierHash: string, reason: string): Promise<void> {
    const { error } = await supabase.from('bans').upsert({
      nullifier_hash: nullifierHash,
      reason,
      banned_at: new Date().toISOString(),
    });
    if (error) throw new Error(`Failed to ban user: ${error.message}`);
    console.log(`[fraud] Banned nullifier: ${nullifierHash} (${reason})`);
  },
};
