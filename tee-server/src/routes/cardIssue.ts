import { Router, type Router as RouterType, Request, Response } from 'express';
import { config } from '../config.js';
import { verify, settle } from '../x402/facilitator.js';
import { createOneTimeCard, cancelCard } from '../stripe/issuing.js';
import { encryptForRecipient } from '../crypto/encrypt.js';
import { signReceipt, getTeePubkey } from '../crypto/signer.js';
import { getFraudCheck } from '../fraud/index.js';
import { logIssuance, markCardCanceled } from '../db/supabase.js';
import {
  encodePaymentRequired,
  decodePaymentPayload,
  PAYMENT_REQUIRED_HEADER,
  PAYMENT_HEADER,
  type PaymentRequirements,
  type SupportedChain,
} from '../x402/types.js';

export const cardIssueRouter: RouterType = Router();

/**
 * POST /v1/card-issue
 *
 * Body (first call — no payment):
 *   { amount_usd_cents: number, agent_pubkey: string, chain: "arc-testnet" | "hedera-testnet", nullifier_hash?: string }
 *
 * Response: 402 with X-PAYMENT-REQUIRED header
 *
 * Body (retry with payment):
 *   Same body, plus X-PAYMENT header containing base64 PaymentPayload
 *
 * Response: 200 with { encrypted_card: string }
 *   Decrypt with agent's ECIES private key to get CardCredentials JSON
 */
cardIssueRouter.post('/', async (req: Request, res: Response) => {
  const { amount_usd_cents, agent_pubkey, chain, nullifier_hash } = req.body as {
    amount_usd_cents?: number;
    agent_pubkey?: string;
    chain?: SupportedChain;
    nullifier_hash?: string;
  };

  // Validate required fields
  if (!amount_usd_cents || amount_usd_cents < 1) {
    return res.status(400).json({ error: 'amount_usd_cents must be >= 1' });
  }
  if (!agent_pubkey) {
    return res.status(400).json({ error: 'agent_pubkey is required' });
  }
  if (!chain || !['arc-testnet', 'hedera-testnet'].includes(chain)) {
    return res.status(400).json({ error: 'chain must be arc-testnet or hedera-testnet' });
  }

  // Check fraud before even revealing payment requirements
  const fraudCheck = getFraudCheck();
  try {
    await fraudCheck.check(nullifier_hash);
  } catch (err) {
    return res.status(403).json({ error: (err as Error).message });
  }

  const paymentHeader = req.headers[PAYMENT_HEADER.toLowerCase()] as string | undefined;

  // No payment yet — return 402 with requirements
  if (!paymentHeader) {
    const requirements: PaymentRequirements = buildRequirements(chain, amount_usd_cents);
    return res
      .status(402)
      .set(PAYMENT_REQUIRED_HEADER, encodePaymentRequired(requirements))
      .json({
        error: 'Payment required',
        paymentRequired: requirements,
      });
  }

  // Payment header present — verify and settle
  let paymentPayload;
  try {
    paymentPayload = decodePaymentPayload(paymentHeader);
  } catch {
    return res.status(400).json({ error: 'Invalid payment payload encoding' });
  }

  const requirements = buildRequirements(chain, amount_usd_cents);

  // Verify payment
  const verifyResult = await verify(paymentPayload, requirements);
  if (!verifyResult.valid) {
    return res.status(402).json({ error: `Payment verification failed: ${verifyResult.error}` });
  }

  // Settle payment on-chain
  const settlementResult = await settle(paymentPayload);
  if (!settlementResult.success) {
    return res.status(402).json({ error: `Payment settlement failed: ${settlementResult.error}` });
  }

  // Use the amount from requirements (what was verified on-chain), not the raw client claim.
  // requirements.maxAmountRequired is in 6-decimal token units (e.g. EURC); convert back to cents.
  const verifiedAmountCents = Math.floor(Number(requirements.maxAmountRequired) / 10_000);

  // Issue one-time Stripe card
  let card;
  try {
    card = await createOneTimeCard(verifiedAmountCents);
  } catch (err) {
    // Settlement succeeded but card creation failed — log for manual resolution
    console.error('[card-issue] Stripe card creation failed after settlement:', err);
    return res.status(500).json({ error: 'Card issuance failed after payment — contact support' });
  }

  // Encrypt card credentials for the requesting agent
  const cardJson = JSON.stringify({
    number: card.number,
    cvc: card.cvc,
    exp_month: card.expMonth,
    exp_year: card.expYear,
    last4: card.last4,
    amount_cents: card.amountCents,
    card_id: card.cardId,
  });

  let encryptedCard: string;
  try {
    encryptedCard = encryptForRecipient(agent_pubkey, cardJson);
  } catch (err) {
    // Cancel card since we can't deliver credentials
    await cancelCard(card.cardId);
    return res.status(400).json({ error: `Failed to encrypt card: invalid agent_pubkey` });
  }

  // Build signed receipt — proof that this TEE issued this card for this payment
  const issuedAt = Math.floor(Date.now() / 1000);
  const receipt = {
    agent_pubkey,
    amount_usd_cents: verifiedAmountCents,
    card_id: card.cardId,
    card_spending_limit_cents: verifiedAmountCents,
    chain,
    issued_at: issuedAt,
    tee_pubkey: getTeePubkey(),
    tx_hash: settlementResult.txHash ?? null,
  };
  const teeSignature = await signReceipt(receipt);

  // Auto-cancel card after 10 minutes if not used
  setTimeout(async () => {
    await cancelCard(card.cardId);
    await markCardCanceled(card.cardId);
  }, 10 * 60 * 1000);

  // Log to audit trail
  await logIssuance({
    agent_pubkey,
    nullifier_hash,
    chain,
    tx_hash: settlementResult.txHash,
    amount_usd_cents: verifiedAmountCents,
    stripe_card_id: card.cardId,
    issued_at: new Date().toISOString(),
  });

  return res.json({
    success: true,
    encrypted_card: encryptedCard,
    card_id: card.cardId,
    expires_in_seconds: 600,
    receipt,
    tee_signature: teeSignature,
    message: 'Decrypt encrypted_card with your ECIES private key to get card credentials',
  });
});

function buildRequirements(chain: SupportedChain, amountUsdCents: number): PaymentRequirements {
  if (chain === 'arc-testnet') {
    // EURC on Arc — 6 decimals, 1 EUR ≈ 1 USD for testnet simplicity
    const eurcAmount = (amountUsdCents * 10_000).toString(); // cents → EURC 6dp (e.g. 100 cents = 1,000,000)
    return {
      x402Version: 1,
      scheme: 'exact',
      network: chain,
      maxAmountRequired: eurcAmount,
      payTo: config.arc.paymentReceiver,
      asset: config.arc.eurcContract,
      description: `One-time virtual card for €${(amountUsdCents / 100).toFixed(2)} (EURC on Arc)`,
    };
  } else {
    // USDC on Hedera HTS — token 0.0.429274, 6 decimals
    const usdcAmount = (amountUsdCents * 10_000).toString(); // cents → USDC 6dp
    return {
      x402Version: 1,
      scheme: 'exact',
      network: chain,
      maxAmountRequired: usdcAmount,
      payTo: config.hedera.paymentReceiver,
      asset: '0.0.429274', // Hedera USDC token ID
      description: `One-time virtual card for $${(amountUsdCents / 100).toFixed(2)} (USDC on Hedera)`,
    };
  }
}
