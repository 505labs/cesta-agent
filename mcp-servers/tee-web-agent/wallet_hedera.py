"""Hedera wallet — builds partially-signed TransferTransaction for x402."""

import os
import json
import base64

try:
    from hedera import (
        Client,
        AccountId,
        PrivateKey,
        TransferTransaction,
        Hbar,
        TransactionId,
    )
    HEDERA_AVAILABLE = True
except ImportError:
    HEDERA_AVAILABLE = False
    import sys
    print("[wallet_hedera] hedera-sdk-python not installed — Hedera payments unavailable", file=sys.stderr)


def build_hedera_payment_payload(requirements: dict) -> str:
    """
    Build a partially-signed Hedera TransferTransaction for x402 and return as base64.
    The TEE facilitator will complete the signature and submit.
    """
    if not HEDERA_AVAILABLE:
        raise RuntimeError("hedera-sdk-python not installed")

    account_id = os.environ["HEDERA_ACCOUNT_ID"]
    private_key_str = os.environ["HEDERA_PRIVATE_KEY"]
    network = os.environ.get("HEDERA_NETWORK", "testnet")

    client = Client.forTestnet() if network == "testnet" else Client.forMainnet()
    private_key = PrivateKey.fromStringDer(private_key_str)
    client.setOperator(AccountId.fromString(account_id), private_key)

    to_account = requirements["payTo"]
    amount_tinybars = int(requirements["maxAmountRequired"])

    # Build transfer transaction
    tx = (
        TransferTransaction()
        .addHbarTransfer(AccountId.fromString(account_id), Hbar.fromTinybars(-amount_tinybars))
        .addHbarTransfer(AccountId.fromString(to_account), Hbar.fromTinybars(amount_tinybars))
        .setTransactionId(TransactionId.generate(AccountId.fromString(account_id)))
        .freezeWith(client)
    )

    # Sign with our key (partial — facilitator adds their signature)
    signed_tx = tx.sign(private_key)
    tx_bytes = signed_tx.toBytes()
    tx_b64 = base64.b64encode(tx_bytes).decode()

    payload = {
        "x402Version": 1,
        "scheme": "exact",
        "network": requirements["network"],
        "payload": {
            "transactionBytes": tx_b64,
            "fromAccount": account_id,
            "toAccount": to_account,
            "amount": str(amount_tinybars),
        },
        "paymentRequirements": requirements,
    }

    return base64.b64encode(json.dumps(payload).encode()).decode()
