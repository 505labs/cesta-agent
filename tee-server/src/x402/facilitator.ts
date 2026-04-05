import { createClient } from 'redis';
import { config } from '../config.js';
import { verifyArcPayment, settleArcPayment } from './arc.js';
import { verifyHederaPayment, settleHederaPayment } from './hedera.js';
import type {
  PaymentPayload,
  PaymentRequirements,
  VerificationResult,
  SettlementResult,
} from './types.js';

// Redis nonce cache — prevents x402 replay attacks
// Nonces are stored for 5 minutes (x402 max window is ~65s, extra buffer)
// Falls back to in-memory Set when Redis is unavailable.
let redis: ReturnType<typeof createClient> | null = null;
let redisUnavailable = false;
const memoryNonces = new Set<string>();

async function getRedis() {
  if (redisUnavailable) return null;
  if (!redis) {
    try {
      redis = createClient({ url: config.redis.url });
      redis.on('error', (err) => {
        console.error('Redis error:', err);
        redisUnavailable = true;
        redis = null;
      });
      await Promise.race([
        redis.connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Redis connect timeout')), 3000)),
      ]);
    } catch (err) {
      console.warn('[facilitator] Redis unavailable, falling back to in-memory nonce cache:', (err as Error).message);
      redisUnavailable = true;
      redis = null;
      return null;
    }
  }
  return redis;
}

const NONCE_TTL_SECONDS = 300;

async function checkAndMarkNonce(nonce: string, chain: string): Promise<boolean> {
  const key = `x402:nonce:${chain}:${nonce}`;
  const r = await getRedis();
  if (!r) {
    // In-memory fallback — no TTL, but sufficient for a running process
    if (memoryNonces.has(key)) return false;
    memoryNonces.add(key);
    return true;
  }
  // SET key 1 NX EX ttl — returns null if already exists
  const result = await r.set(key, '1', { NX: true, EX: NONCE_TTL_SECONDS });
  return result === 'OK'; // true = first time seen, false = replay
}

export async function verify(
  payload: PaymentPayload,
  requirements: PaymentRequirements
): Promise<VerificationResult> {
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
      return verifyArcPayment(payload, requirements);
    case 'hedera-testnet':
      return verifyHederaPayment(payload, requirements);
    default:
      return { valid: false, error: `Unsupported network: ${(payload as any).network}` };
  }
}

export async function settle(
  payload: PaymentPayload
): Promise<SettlementResult> {
  switch (payload.network) {
    case 'arc-testnet':
      return settleArcPayment(payload);
    case 'hedera-testnet':
      return settleHederaPayment(payload);
    default:
      return { success: false, error: `Unsupported network: ${(payload as any).network}` };
  }
}

function extractNonce(payload: PaymentPayload): string | null {
  const data = payload.payload as any;
  // EVM: authorization.nonce
  if (data.authorization?.nonce) return data.authorization.nonce;
  // Hedera: transactionBytes hash or txId
  if (data.transactionBytes) {
    return Buffer.from(data.transactionBytes, 'base64').slice(0, 32).toString('hex');
  }
  return null;
}
