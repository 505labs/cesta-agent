"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptForRecipient = encryptForRecipient;
exports.decryptWithPrivateKey = decryptWithPrivateKey;
const eciesjs_1 = require("eciesjs");
/**
 * Encrypt arbitrary data with a recipient's secp256k1 public key.
 * The recipient decrypts with their private key.
 *
 * @param recipientPublicKeyHex - 65-byte uncompressed or 33-byte compressed hex pubkey (with or without 0x)
 * @param data - plaintext string (JSON)
 * @returns base64-encoded ciphertext
 */
function encryptForRecipient(recipientPublicKeyHex, data) {
    // eciesjs encrypt accepts compressed pubkey hex (33 bytes / 66 hex chars)
    const ciphertext = (0, eciesjs_1.encrypt)(recipientPublicKeyHex, Buffer.from(data, 'utf8'));
    return Buffer.from(ciphertext).toString('base64');
}
/**
 * Decrypt ciphertext with a private key (for testing / agent-side use).
 */
function decryptWithPrivateKey(privateKeyHex, ciphertextBase64) {
    const plaintext = (0, eciesjs_1.decrypt)(privateKeyHex, Buffer.from(ciphertextBase64, 'base64'));
    return Buffer.from(plaintext).toString('utf8');
}
