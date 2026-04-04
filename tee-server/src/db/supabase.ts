import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

export const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey
);

export interface IssuanceRecord {
  agent_pubkey: string;
  nullifier_hash?: string;
  chain: string;
  tx_hash?: string;
  amount_usd_cents: number;
  stripe_card_id: string;
  issued_at: string;
  canceled_at?: string;
}

export async function logIssuance(record: IssuanceRecord): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('issuances')
      .insert(record)
      .select('id')
      .single();

    if (error) {
      // Non-fatal: log locally and continue — don't block card issuance
      console.warn('[db] Failed to log issuance (non-fatal):', error.message);
      console.warn('[db] Action needed: run supabase_schema.sql + set SUPABASE_SERVICE_ROLE_KEY=sb_secret_...');
      return null;
    }
    return data?.id ?? null;
  } catch (err) {
    console.warn('[db] Supabase unreachable (non-fatal):', (err as Error).message);
    return null;
  }
}

export async function markCardCanceled(stripeCardId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('issuances')
      .update({ canceled_at: new Date().toISOString() })
      .eq('stripe_card_id', stripeCardId);

    if (error) {
      console.warn('[db] Failed to mark card canceled (non-fatal):', error.message);
    }
  } catch (err) {
    console.warn('[db] Supabase unreachable (non-fatal):', (err as Error).message);
  }
}

/**
 * SQL to run in Supabase SQL editor to create the schema:
 *
 * create table bans (
 *   nullifier_hash text primary key,
 *   banned_at timestamptz not null default now(),
 *   reason text
 * );
 *
 * create table issuances (
 *   id uuid primary key default gen_random_uuid(),
 *   agent_pubkey text not null,
 *   nullifier_hash text,
 *   chain text not null,
 *   tx_hash text,
 *   amount_usd_cents int not null,
 *   stripe_card_id text not null,
 *   issued_at timestamptz not null default now(),
 *   canceled_at timestamptz
 * );
 */
