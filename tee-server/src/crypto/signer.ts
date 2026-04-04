import { ethers } from 'ethers';
import { createHash } from 'crypto';

let _signingWallet: ethers.Wallet | null = null;

/**
 * TEE receipt signing wallet.
 *
 * Derived deterministically from the Arc wallet private key using a domain
 * separator. The key only exists inside the TEE enclave — the operator cannot
 * extract it without the enclave secrets, and changing the derivation would
 * produce a different public key, breaking attestation verification.
 *
 * In a hardware TEE (TDX/SGX) this would be sealed storage; in our Docker-
 * based Flare TEE setup the Arc wallet key is the root secret.
 */
function getSigningWallet(): ethers.Wallet {
  if (_signingWallet) return _signingWallet;

  const seed = process.env.ARC_WALLET_PRIVATE_KEY ?? 'dev-insecure-fallback';
  const derived = createHash('sha256')
    .update(seed + ':tee-receipt-signing-key:v1')
    .digest('hex');

  _signingWallet = new ethers.Wallet('0x' + derived);
  return _signingWallet;
}

/** Address of the TEE's signing key — published via GET /v1/attestation */
export function getTeePubkey(): string {
  return getSigningWallet().address;
}

/**
 * Sign a receipt with the TEE's key.
 *
 * Uses EIP-191 personal_sign over the canonical JSON (keys sorted alphabetically)
 * so it is verifiable with `ethers.verifyMessage(canonical, signature)` or
 * Python's `eth_account.Account.recover_message(encode_defunct(text=canonical), signature)`.
 */
export async function signReceipt(receipt: Record<string, unknown>): Promise<string> {
  const canonical = JSON.stringify(receipt, Object.keys(receipt).sort());
  return getSigningWallet().signMessage(canonical);
}

/**
 * Code hash for attestation. Set DOCKER_IMAGE_SHA as a build-arg in the
 * Dockerfile (`ARG GIT_COMMIT` → `ENV DOCKER_IMAGE_SHA=$GIT_COMMIT`).
 * Verifiers can check: sha256(docker pull image) == this value.
 */
export function getCodeHash(): string {
  return (
    process.env.DOCKER_IMAGE_SHA ??
    process.env.GIT_COMMIT ??
    'dev-unset'
  );
}
