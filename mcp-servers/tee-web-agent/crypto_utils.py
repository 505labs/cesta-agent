"""ECIES key generation and decryption for the web agent.

Uses eciespy which is compatible with the eciesjs library used in the TEE server.
Both use secp256k1 + AES-256-GCM.

Key format note: eciesjs uses compressed pubkey (33 bytes / 66 hex chars).
eciespy's eth_key generates keys compatible with this format.
"""

import json
import base64
from ecies.utils import generate_eth_key
from ecies import encrypt, decrypt


def generate_keypair() -> tuple[str, str]:
    """
    Generate a fresh secp256k1 keypair for this agent session.
    Returns (private_key_hex, public_key_compressed_hex).

    The compressed public key (33 bytes / 66 hex chars) is what the
    TEE server's eciesjs encrypt() expects.
    """
    eth_key = generate_eth_key()
    # Private key as 32-byte hex (no 0x prefix)
    private_key_hex = eth_key.to_hex()
    # Compressed public key: 33 bytes → 66 hex chars
    public_key_hex = eth_key.public_key.to_compressed_bytes().hex()
    return private_key_hex, public_key_hex


def decrypt_card_credentials(private_key_hex: str, encrypted_b64: str) -> dict:
    """
    Decrypt ECIES-encrypted card credentials from the TEE server.

    Args:
        private_key_hex: 32-byte private key hex (no 0x prefix)
        encrypted_b64: base64-encoded ciphertext from TEE

    Returns:
        dict with: number, cvc, exp_month, exp_year, last4, amount_cents, card_id
    """
    ciphertext = base64.b64decode(encrypted_b64)
    plaintext = decrypt(private_key_hex, ciphertext)
    return json.loads(plaintext.decode("utf-8"))
