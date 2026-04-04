#!/usr/bin/env python3
"""
x402-pay MCP server — expose x402 crypto payments and TEE card issuance as MCP tools.

Also serves as a Flare FCC extension-tee handler: receives on-chain instructions
and processes them inside the TEE.

Start:    python server.py
Register: claude mcp add x402-pay -- python /path/to/server.py
Docker:   extension-tee service in docker-compose.yml
"""
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

import logging
import os
import sys
import json
from mcp.server.fastmcp import FastMCP
from x402_client import X402Client
from crypto_utils import generate_keypair, decrypt_card_credentials

# ── Logging to file ───────────────────────────────────────────────────────────
LOG_PATH = Path("/tmp/tee_pay.log")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s]  %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stderr),
        logging.FileHandler(LOG_PATH, mode="w"),
    ],
)
log = logging.getLogger("x402_client")
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

mcp = FastMCP("x402-pay")


@mcp.tool()
def get_attestation(chain: str = "arc-testnet") -> str:
    """
    Fetch the TEE attestation — verify the code hash and public key of the TEE.

    Use this before paying to confirm the TEE is running the expected audited code.
    The code_hash should match the published Docker image SHA on GitHub.

    Args:
        chain: "arc-testnet" (default) or "hedera-testnet"
    """
    log.info(f"─── get_attestation  chain={chain} ───")
    client = X402Client(agent_pubkey="0x0000000000000000000000000000000000000000", chain=chain)
    a = client.fetch_attestation()
    lines = [
        "🔍 TEE Attestation",
        f"  Code hash : {a.get('code_hash')}",
        f"  TEE pubkey: {a.get('tee_pubkey')}",
        f"  Chains    : {', '.join(a.get('chains', []))}",
        f"  Timestamp : {a.get('timestamp')}",
        "",
        "Verify: code_hash should match the published Docker image SHA on GitHub.",
        "The TEE signing key is derived deterministically from the enclave seed.",
    ]
    return "\n".join(lines)


@mcp.tool()
def request_card(amount_cents: int, chain: str = "arc-testnet") -> str:
    """
    Pay crypto via x402 and receive a TEE-issued one-time Stripe card.

    The flow:
    1. Generates an ephemeral keypair for this request
    2. Sends x402 payment (EURC on Arc, or USDC on Hedera) to the TEE
    3. TEE verifies on-chain payment and issues a Stripe virtual card
    4. Card spending limit = exactly what was paid (enforced by Stripe Issuing)
    5. Card credentials are ECIES-encrypted — only this agent can decrypt them
    6. Receipt is signed by the TEE key (verifiable via ecrecover)

    Args:
        amount_cents: Amount in integer cents (e.g. 499 for $4.99 / €4.99)
        chain:        "arc-testnet" (default) or "hedera-testnet"

    Returns card details ready for use in a payment form.
    """
    log.info(f"─── request_card  amount=€{amount_cents/100:.2f}  chain={chain} ───")
    private_key, public_key = generate_keypair()
    log.info(f"ephemeral keypair  pubkey={public_key[:16]}…")
    client = X402Client(agent_pubkey=public_key, chain=chain)

    try:
        response = client.request_card(amount_usd_cents=amount_cents)
    except Exception as e:
        log.error(f"card request failed: {e}")
        return f"❌ Card request failed: {e}"

    try:
        card = decrypt_card_credentials(private_key, response["encrypted_card"])
        log.info(f"card decrypted  **** {card.get('last4')}  exp {card.get('exp_month'):02d}/{card.get('exp_year')}")
    except Exception as e:
        log.error(f"decryption failed: {e}")
        return f"❌ Decryption failed: {e}"

    receipt = response.get("receipt", {})
    tx_hash = receipt.get("tx_hash", "N/A")

    currency_symbol = "€"  # EURC on Arc

    lines = [
        "✅ One-time card issued",
        f"  Card ID  : {response.get('card_id')}",
        f"  Number   : {card['number']}",
        f"  Expiry   : {card['exp_month']:02d}/{card['exp_year']}",
        f"  CVC      : {card['cvc']}",
        f"  Limit    : {currency_symbol}{amount_cents/100:.2f} (enforced by Stripe — cannot overspend)",
        f"  TX       : {tx_hash}",
        f"  TEE sig  : {response.get('tee_signature', 'N/A')[:40]}...",
        "",
        "⚠️  Card is single-use and auto-cancels after one transaction.",
    ]
    return "\n".join(lines)


# ── Flare FCC extension-tee handler ───────────────────────────────────────────

def handle_fcc_instruction(hex_payload: str) -> dict:
    """
    Flare FCC extension handler. Called by ext-proxy when an on-chain instruction arrives.

    Expected payload (JSON encoded as hex):
    { "action": "issue_card", "amount_cents": 499, "chain": "arc-testnet", "agent_pubkey": "0x..." }

    Returns: { "result": <hex-encoded JSON response>, "status": 1, "error": null }
    """
    try:
        payload = json.loads(bytes.fromhex(hex_payload.removeprefix("0x")).decode())
        action = payload.get("action")

        if action == "issue_card":
            amount_cents = int(payload["amount_cents"])
            chain = payload.get("chain", "arc-testnet")
            agent_pubkey = payload["agent_pubkey"]

            client = X402Client(agent_pubkey=agent_pubkey, chain=chain)
            response = client.request_card(amount_usd_cents=amount_cents)
            result_hex = "0x" + json.dumps(response).encode().hex()
            return {"result": result_hex, "status": 1, "error": None}

        elif action == "attestation":
            chain = payload.get("chain", "arc-testnet")
            client = X402Client(agent_pubkey="0x0" * 20, chain=chain)
            attestation = client.fetch_attestation()
            result_hex = "0x" + json.dumps(attestation).encode().hex()
            return {"result": result_hex, "status": 1, "error": None}

        else:
            return {"result": "0x", "status": 0, "error": {"message": f"Unknown action: {action}"}}

    except Exception as e:
        return {"result": "0x", "status": 0, "error": {"message": str(e)}}


def _start_log_server():
    import subprocess, socket
    PORT = 4243
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        if s.connect_ex(("localhost", PORT)) == 0:
            return  # already running
    log_server = Path(__file__).parent / "tee_log_server.py"
    subprocess.Popen(
        [sys.executable, str(log_server), "--port", str(PORT)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--fcc":
        # Run as Flare FCC handler (reads hex from stdin, writes JSON to stdout)
        import sys
        for line in sys.stdin:
            result = handle_fcc_instruction(line.strip())
            print(json.dumps(result), flush=True)
    else:
        _start_log_server()
        mcp.run(transport="stdio")
