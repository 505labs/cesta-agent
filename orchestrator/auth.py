"""
Wallet-based authentication using Sign-In with Ethereum (SIWE).

Flow:
1. Frontend requests a nonce via GET /v1/auth/nonce
2. Frontend signs a SIWE message with the wallet
3. Frontend sends signature to POST /v1/auth/verify
4. Backend verifies and returns a session token

Uses eth_account for signature verification (more reliable than the siwe package).
"""

import os
import secrets
import time

from eth_account.messages import encode_defunct
from eth_account import Account

ALLOWED_DOMAINS = os.environ.get("ALLOWED_DOMAINS", "localhost,localhost:3000,localhost:8080").split(",")

# In-memory nonce store (good enough for hackathon)
_nonces: dict[str, float] = {}  # nonce -> expiry timestamp
NONCE_TTL = 300  # 5 minutes

# In-memory session store
_sessions: dict[str, dict] = {}  # token -> {wallet_address, created_at}
SESSION_TTL = 86400  # 24 hours


def generate_nonce() -> str:
    nonce = secrets.token_hex(16)
    _nonces[nonce] = time.time() + NONCE_TTL
    return nonce


def _parse_siwe_message(message: str) -> dict:
    """Parse a SIWE message string into its components."""
    lines = message.strip().split("\n")
    result = {}

    # First line: "{domain} wants you to sign in with your Ethereum account:"
    if "wants you to sign in" in lines[0]:
        result["domain"] = lines[0].split(" wants you to sign in")[0].strip()

    # Second line: address
    if len(lines) > 1:
        addr = lines[1].strip()
        if addr.startswith("0x"):
            result["address"] = addr

    # Parse key-value fields
    for line in lines:
        line = line.strip()
        if line.startswith("Nonce:"):
            result["nonce"] = line.split(":", 1)[1].strip()
        elif line.startswith("URI:"):
            result["uri"] = line.split(":", 1)[1].strip()
        elif line.startswith("Version:"):
            result["version"] = line.split(":", 1)[1].strip()
        elif line.startswith("Chain ID:"):
            result["chain_id"] = line.split(":", 1)[1].strip()
        elif line.startswith("Issued At:"):
            result["issued_at"] = line.split(":", 1)[1].strip()

    return result


def verify_siwe(message: str, signature: str) -> str:
    """Verify a SIWE message and return the wallet address."""
    parsed = _parse_siwe_message(message)

    # Check nonce
    nonce = parsed.get("nonce")
    if not nonce:
        raise ValueError("No nonce found in message")

    expiry = _nonces.pop(nonce, None)
    if expiry is None or time.time() > expiry:
        raise ValueError("Invalid or expired nonce")

    # Validate domain
    domain = parsed.get("domain", "")
    if domain and ALLOWED_DOMAINS[0] != "*":
        if domain not in ALLOWED_DOMAINS:
            raise ValueError(f"Domain not allowed: {domain}")

    # Verify signature using eth_account
    message_hash = encode_defunct(text=message)
    recovered_address = Account.recover_message(message_hash, signature=signature)

    expected_address = parsed.get("address", "")
    if recovered_address.lower() != expected_address.lower():
        raise ValueError(f"Signature mismatch: expected {expected_address}, got {recovered_address}")

    return recovered_address


def create_session(wallet_address: str) -> str:
    """Create a session token for an authenticated wallet."""
    token = secrets.token_hex(32)
    _sessions[token] = {
        "wallet_address": wallet_address.lower(),
        "created_at": time.time(),
    }
    return token


def get_session(token: str) -> dict | None:
    """Get session data from a token. Returns None if invalid/expired."""
    session = _sessions.get(token)
    if not session:
        return None
    if time.time() - session["created_at"] > SESSION_TTL:
        _sessions.pop(token, None)
        return None
    return session


def get_wallet_from_request(authorization: str | None) -> str | None:
    """Extract wallet address from Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[7:]
    session = get_session(token)
    return session["wallet_address"] if session else None
