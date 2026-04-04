import 'dotenv/config';
import express, { type Express } from 'express';
import { config } from './config.js';
import { cardIssueRouter } from './routes/cardIssue.js';
import { adminRouter } from './routes/admin.js';
import { getTeePubkey, getCodeHash, signReceipt } from './crypto/signer.js';
import { ethers } from 'ethers';

const app: Express = express();
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    worldId: config.worldId.enabled,
    chains: ['arc-testnet', 'hedera-testnet'],
  });
});

/**
 * GET /v1/attestation
 *
 * Returns a verifiable attestation of what code is running in this TEE.
 *
 * Verification steps for a user:
 *   1. GET /v1/attestation — note tee_pubkey and code_hash
 *   2. Check code_hash matches the published Docker image SHA on GitHub
 *   3. On every /v1/card-issue response, verify:
 *        ethers.verifyMessage(JSON.stringify(receipt, sortedKeys), tee_signature) === tee_pubkey
 *   4. Confirm receipt.amount_usd_cents === receipt.card_spending_limit_cents (card limit = what you paid)
 *
 * The tee_pubkey is derived inside the enclave from the TEE's root secret.
 * An operator who modifies the code would produce a different code_hash (breaking step 2)
 * or lose access to the signing key (breaking step 3).
 */
app.get('/v1/attestation', async (_req, res) => {
  const teePubkey = getTeePubkey();
  const codeHash = getCodeHash();

  // Self-sign the attestation so clients can verify the pubkey is live
  const attestation = {
    code_hash: codeHash,
    tee_pubkey: teePubkey,
    chains: ['arc-testnet', 'hedera-testnet'],
    timestamp: Math.floor(Date.now() / 1000),
    version: '1',
  };
  const attestation_signature = await signReceipt(attestation as Record<string, unknown>);

  res.json({
    ...attestation,
    attestation_signature,
    verify_instructions: {
      step1: 'Check code_hash matches the published Docker image digest at github.com/your-repo/releases',
      step2: 'On each /v1/card-issue response, run: ethers.verifyMessage(JSON.stringify(receipt, sortedKeys), tee_signature)',
      step3: 'Confirm the recovered address === tee_pubkey from this endpoint',
      step4: 'Confirm receipt.amount_usd_cents === receipt.card_spending_limit_cents',
    },
  });
});

/**
 * POST /v1/verify-receipt
 *
 * Utility endpoint — verifies a receipt + signature inline.
 * Body: { receipt: object, tee_signature: string }
 * Returns: { valid: bool, recovered_pubkey: string, expected_pubkey: string }
 */
app.post('/v1/verify-receipt', async (req, res) => {
  const { receipt, tee_signature } = req.body as { receipt?: Record<string, unknown>; tee_signature?: string };
  if (!receipt || !tee_signature) {
    return res.status(400).json({ error: 'receipt and tee_signature required' });
  }
  try {
    const canonical = JSON.stringify(receipt, Object.keys(receipt).sort());
    const recovered = ethers.verifyMessage(canonical, tee_signature);
    const expected = getTeePubkey();
    res.json({ valid: recovered.toLowerCase() === expected.toLowerCase(), recovered_pubkey: recovered, expected_pubkey: expected });
  } catch (err) {
    res.status(400).json({ valid: false, error: (err as Error).message });
  }
});

// Card issuance (x402 gated)
app.use('/v1/card-issue', cardIssueRouter);

// Admin (ban management, audit log)
app.use('/admin', adminRouter);

// x402 facilitator endpoints (for external merchants who want to use our TEE)
app.post('/facilitator/verify', async (req, res) => {
  const { verify } = await import('./x402/facilitator.js');
  const { payload, requirements } = req.body;
  if (!payload || !requirements) {
    return res.status(400).json({ error: 'payload and requirements required' });
  }
  const result = await verify(payload, requirements);
  res.json(result);
});

app.post('/facilitator/settle', async (req, res) => {
  const { settle } = await import('./x402/facilitator.js');
  const { payload } = req.body;
  if (!payload) {
    return res.status(400).json({ error: 'payload required' });
  }
  const result = await settle(payload);
  res.json(result);
});

app.listen(config.port, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║     TEE Card Issuer — running on :${config.port}     ║
╠══════════════════════════════════════════════╣
║  POST /v1/card-issue    — x402 card issuance ║
║  POST /facilitator/*    — x402 facilitator   ║
║  POST /admin/ban        — ban fraud users    ║
║  GET  /health           — health check       ║
╠══════════════════════════════════════════════╣
║  World ID: ${config.worldId.enabled ? 'ENABLED  ' : 'DISABLED '}                        ║
║  Chains:   Arc testnet + Hedera testnet      ║
╚══════════════════════════════════════════════╝
  `);
});

export default app;
