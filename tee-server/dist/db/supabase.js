"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
exports.logIssuance = logIssuance;
exports.markCardCanceled = markCardCanceled;
const supabase_js_1 = require("@supabase/supabase-js");
const config_js_1 = require("../config.js");
exports.supabase = (0, supabase_js_1.createClient)(config_js_1.config.supabase.url, config_js_1.config.supabase.serviceRoleKey);
async function logIssuance(record) {
    try {
        const { data, error } = await exports.supabase
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
    }
    catch (err) {
        console.warn('[db] Supabase unreachable (non-fatal):', err.message);
        return null;
    }
}
async function markCardCanceled(stripeCardId) {
    try {
        const { error } = await exports.supabase
            .from('issuances')
            .update({ canceled_at: new Date().toISOString() })
            .eq('stripe_card_id', stripeCardId);
        if (error) {
            console.warn('[db] Failed to mark card canceled (non-fatal):', error.message);
        }
    }
    catch (err) {
        console.warn('[db] Supabase unreachable (non-fatal):', err.message);
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
