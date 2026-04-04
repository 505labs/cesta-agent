import {
  Client,
  PrivateKey,
  AccountId,
  TokenId,
  Transaction,
  TransferTransaction,
} from '@hashgraph/sdk';
import { config } from '../config.js';
import type {
  PaymentRequirements,
  PaymentPayload,
  VerificationResult,
  SettlementResult,
  HederaPayloadData,
} from './types.js';

// Hedera testnet USDC token
const HEDERA_USDC_TOKEN_ID = '0.0.429274';

function getClient(): Client {
  const client =
    config.hedera.network === 'mainnet'
      ? Client.forMainnet()
      : Client.forTestnet();

  client.setOperator(
    AccountId.fromString(config.hedera.accountId),
    PrivateKey.fromStringDer(config.hedera.privateKey)
  );
  return client;
}

export async function verifyHederaPayment(
  payload: PaymentPayload,
  requirements: PaymentRequirements
): Promise<VerificationResult> {
  try {
    const data = payload.payload as HederaPayloadData;

    // Check destination matches
    if (data.toAccount !== requirements.payTo) {
      return { valid: false, error: 'Invalid payment destination' };
    }

    // Check amount meets requirements
    if (BigInt(data.amount) < BigInt(requirements.maxAmountRequired)) {
      return { valid: false, error: 'Payment amount too low' };
    }

    // Verify asset matches (USDC token ID)
    if (requirements.asset !== HEDERA_USDC_TOKEN_ID) {
      return { valid: false, error: `Unsupported asset: ${requirements.asset}, expected ${HEDERA_USDC_TOKEN_ID}` };
    }

    // Deserialize and validate the partially-signed transaction
    const txBytes = Buffer.from(data.transactionBytes, 'base64');
    const tx = Transaction.fromBytes(txBytes);

    if (!(tx instanceof TransferTransaction)) {
      return { valid: false, error: 'Expected a TransferTransaction' };
    }

    // Verify expiry (Hedera tx valid window ~180s)
    const txId = tx.transactionId;
    if (txId?.validStart) {
      const validStartMs = txId.validStart.seconds.toNumber() * 1000;
      if (Date.now() > validStartMs + 180_000) {
        return { valid: false, error: 'Transaction expired' };
      }
    }

    return { valid: true };
  } catch (err) {
    return { valid: false, error: `Hedera verification error: ${(err as Error).message}` };
  }
}

export async function settleHederaPayment(
  payload: PaymentPayload
): Promise<SettlementResult> {
  try {
    const data = payload.payload as HederaPayloadData;
    const client = getClient();

    // Deserialize the partially-signed tx and add facilitator signature
    const txBytes = Buffer.from(data.transactionBytes, 'base64');
    const tx = Transaction.fromBytes(txBytes);
    const facilitatorKey = PrivateKey.fromStringDer(config.hedera.privateKey);
    const signedTx = await tx.sign(facilitatorKey);
    const response = await signedTx.execute(client);
    const receipt = await response.getReceipt(client);
    client.close();

    if (receipt.status.toString() !== 'SUCCESS') {
      return { success: false, error: `Hedera tx failed: ${receipt.status}` };
    }

    return { success: true, txHash: response.transactionId.toString() };
  } catch (err) {
    return { success: false, error: `Hedera settlement error: ${(err as Error).message}` };
  }
}
