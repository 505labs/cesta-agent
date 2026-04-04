/**
 * Encrypt arbitrary data with a recipient's secp256k1 public key.
 * The recipient decrypts with their private key.
 *
 * @param recipientPublicKeyHex - 65-byte uncompressed or 33-byte compressed hex pubkey (with or without 0x)
 * @param data - plaintext string (JSON)
 * @returns base64-encoded ciphertext
 */
export declare function encryptForRecipient(recipientPublicKeyHex: string, data: string): string;
/**
 * Decrypt ciphertext with a private key (for testing / agent-side use).
 */
export declare function decryptWithPrivateKey(privateKeyHex: string, ciphertextBase64: string): string;
