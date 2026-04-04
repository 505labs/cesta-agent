"""x402 HTTP client — handles 402 Payment Required flow automatically."""

import logging
import os
import json
import httpx
from typing import Any

log = logging.getLogger("x402_client")


def _verify_tee_receipt(receipt: dict, tee_signature: str, tee_pubkey: str) -> bool:
    """
    Verify a signed receipt from the TEE.

    The TEE signs JSON.stringify(receipt, sortedKeys) with EIP-191 personal_sign.
    We recover the signer and compare against tee_pubkey (from /v1/attestation).
    """
    from eth_account import Account
    from eth_account.messages import encode_defunct

    # Must match JavaScript's JSON.stringify: compact, no spaces
    canonical = json.dumps(receipt, sort_keys=True, separators=(',', ':'))
    msg = encode_defunct(text=canonical)
    try:
        recovered = Account.recover_message(msg, signature=tee_signature)
        match = recovered.lower() == tee_pubkey.lower()
        if not match:
            log.error(f"[x402] Receipt signature mismatch: recovered={recovered} expected={tee_pubkey}")
        return match
    except Exception as e:
        log.error(f"[x402] Receipt signature verification failed: {e}")
        return False


class X402Client:
    """
    HTTP client that handles the x402 payment flow:
    1. Makes a request
    2. If 402 received, pays via the configured chain
    3. Retries with X-PAYMENT header
    """

    def __init__(self, agent_pubkey: str, chain: str = "arc-testnet"):
        self.agent_pubkey = agent_pubkey
        self.chain = chain
        self.tee_url = os.environ.get("TEE_SERVER_URL", "http://localhost:3000")
        self._tee_pubkey: str | None = None  # cached from /v1/attestation

    def fetch_attestation(self) -> dict:
        """
        Fetch TEE attestation and cache the tee_pubkey.
        The caller should verify code_hash against the published GitHub release.
        """
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(f"{self.tee_url}/v1/attestation")
            resp.raise_for_status()
            attestation = resp.json()

        self._tee_pubkey = attestation.get("tee_pubkey")
        log.info(f"attestation  code={attestation.get('code_hash', 'N/A')[:18]}…  key={self._tee_pubkey}")
        return attestation

    def request_card(
        self,
        amount_usd_cents: int,
        nullifier_hash: str | None = None,
    ) -> dict:
        """
        Request a one-time card from the TEE server.
        Handles the 402 → pay → retry flow automatically.

        Returns decrypted card credentials dict.
        """
        url = f"{self.tee_url}/v1/card-issue"
        body: dict[str, Any] = {
            "amount_usd_cents": amount_usd_cents,
            "agent_pubkey": self.agent_pubkey,
            "chain": self.chain,
        }
        if nullifier_hash:
            body["nullifier_hash"] = nullifier_hash

        with httpx.Client(timeout=60.0) as client:
            log.info(f"card request  amount=€{amount_usd_cents / 100:.2f}  chain={self.chain}")
            resp = client.post(url, json=body)

            if resp.status_code == 200:
                log.info("card issued immediately (no 402)")
                return resp.json()

            if resp.status_code != 402:
                log.error(f"unexpected {resp.status_code}: {resp.text[:200]}")
                raise RuntimeError(f"Unexpected status {resp.status_code}: {resp.text}")

            requirements = self._parse_requirements(resp)
            network = requirements.get('network', self.chain)
            pay_to = requirements.get('payTo', '')
            log.info(f"← 402 Payment Required  network={network}  payTo={pay_to[:10]}…")

            payment_b64 = self._build_payment(requirements)

            log.info(f"→ submitting payment  network={network}")
            resp2 = client.post(url, json=body, headers={"X-PAYMENT": payment_b64})

            if resp2.status_code != 200:
                log.error(f"payment rejected  {resp2.status_code}: {resp2.text[:200]}")
                raise RuntimeError(f"Payment failed ({resp2.status_code}): {resp2.text}")

            data = resp2.json()
            receipt = data.get("receipt", {})
            tx_hash = receipt.get("tx_hash", "N/A")
            card_id = data.get('card_id', 'N/A')
            explorer = (f"https://testnet.arcscan.app/tx/{tx_hash}" if "arc" in self.chain
                        else f"https://hashscan.io/testnet/transaction/{tx_hash}")
            log.info(f"card issued  id={card_id}  tx={tx_hash}  {explorer}")

            # ── Receipt verification ───────────────────────────────────────────
            tee_signature = data.get("tee_signature")

            if receipt and tee_signature and self._tee_pubkey:
                valid = _verify_tee_receipt(receipt, tee_signature, self._tee_pubkey)
                if valid:
                    paid = receipt.get("amount_usd_cents")
                    limit = receipt.get("card_spending_limit_cents")
                    if paid != limit:
                        raise RuntimeError(f"receipt fraud: paid={paid} limit={limit}")
                    log.info(f"receipt verified ✓  limit=€{limit/100:.2f}  sig={tee_signature[:16]}…")
                else:
                    raise RuntimeError("TEE receipt signature invalid — aborting")
            elif receipt and tee_signature and not self._tee_pubkey:
                log.warning("receipt present but attestation not fetched — skipping sig check")
            else:
                log.warning("no signed receipt — TEE may be running old code")

            return data

    def _parse_requirements(self, resp: httpx.Response) -> dict:
        """Extract PaymentRequirements from 402 response."""
        import base64

        header = resp.headers.get("X-PAYMENT-REQUIRED") or resp.headers.get("x-payment-required")
        if header:
            return json.loads(base64.b64decode(header).decode())

        body = resp.json()
        if "paymentRequired" in body:
            return body["paymentRequired"]

        raise RuntimeError("No payment requirements in 402 response")

    def _build_payment(self, requirements: dict) -> str:
        """Build the appropriate payment payload for the chain."""
        network = requirements.get("network", self.chain)

        if network.startswith("arc"):
            from wallet_arc import build_arc_payment_payload
            chain_id = int(os.environ.get("ARC_CHAIN_ID", "5042002"))
            return build_arc_payment_payload(requirements, chain_id)

        elif network.startswith("hedera"):
            from wallet_hedera import build_hedera_payment_payload
            return build_hedera_payment_payload(requirements)

        else:
            raise ValueError(f"Unsupported network: {network}")
