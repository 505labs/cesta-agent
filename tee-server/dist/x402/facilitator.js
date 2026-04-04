"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verify = verify;
exports.settle = settle;
const redis_1 = require("redis");
const config_js_1 = require("../config.js");
const arc_js_1 = require("./arc.js");
const hedera_js_1 = require("./hedera.js");
// Redis nonce cache — prevents x402 replay attacks
// Nonces are stored for 5 minutes (x402 max window is ~65s, extra buffer)
let redis = null;
async function getRedis() {
    if (!redis) {
        redis = (0, redis_1.createClient)({ url: config_js_1.config.redis.url });
        redis.on('error', (err) => console.error('Redis error:', err));
        await redis.connect();
    }
    return redis;
}
const NONCE_TTL_SECONDS = 300;
async function checkAndMarkNonce(nonce, chain) {
    const r = await getRedis();
    const key = `x402:nonce:${chain}:${nonce}`;
    // SET key 1 NX EX ttl — returns null if already exists
    const result = await r.set(key, '1', { NX: true, EX: NONCE_TTL_SECONDS });
    return result === 'OK'; // true = first time seen, false = replay
}
async function verify(payload, requirements) {
    const nonce = extractNonce(payload);
    // Replay check
    if (nonce) {
        const fresh = await checkAndMarkNonce(nonce, payload.network);
        if (!fresh) {
            return { valid: false, error: 'Replay attack detected: nonce already used' };
        }
    }
    switch (payload.network) {
        case 'arc-testnet':
            return (0, arc_js_1.verifyArcPayment)(payload, requirements);
        case 'hedera-testnet':
            return (0, hedera_js_1.verifyHederaPayment)(payload, requirements);
        default:
            return { valid: false, error: `Unsupported network: ${payload.network}` };
    }
}
async function settle(payload) {
    switch (payload.network) {
        case 'arc-testnet':
            return (0, arc_js_1.settleArcPayment)(payload);
        case 'hedera-testnet':
            return (0, hedera_js_1.settleHederaPayment)(payload);
        default:
            return { success: false, error: `Unsupported network: ${payload.network}` };
    }
}
function extractNonce(payload) {
    const data = payload.payload;
    // EVM: authorization.nonce
    if (data.authorization?.nonce)
        return data.authorization.nonce;
    // Hedera: transactionBytes hash or txId
    if (data.transactionBytes) {
        return Buffer.from(data.transactionBytes, 'base64').slice(0, 32).toString('hex');
    }
    return null;
}
