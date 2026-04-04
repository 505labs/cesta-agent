/** Address of the TEE's signing key — published via GET /v1/attestation */
export declare function getTeePubkey(): string;
/**
 * Sign a receipt with the TEE's key.
 *
 * Uses EIP-191 personal_sign over the canonical JSON (keys sorted alphabetically)
 * so it is verifiable with `ethers.verifyMessage(canonical, signature)` or
 * Python's `eth_account.Account.recover_message(encode_defunct(text=canonical), signature)`.
 */
export declare function signReceipt(receipt: Record<string, unknown>): Promise<string>;
/**
 * Code hash for attestation. Set DOCKER_IMAGE_SHA as a build-arg in the
 * Dockerfile (`ARG GIT_COMMIT` → `ENV DOCKER_IMAGE_SHA=$GIT_COMMIT`).
 * Verifiers can check: sha256(docker pull image) == this value.
 */
export declare function getCodeHash(): string;
