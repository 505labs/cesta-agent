export declare const supabase: import("@supabase/supabase-js").SupabaseClient<any, "public", "public", any, any>;
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
export declare function logIssuance(record: IssuanceRecord): Promise<string | null>;
export declare function markCardCanceled(stripeCardId: string): Promise<void>;
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
