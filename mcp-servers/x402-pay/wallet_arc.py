"""Arc (EVM) wallet — builds EIP-3009 transferWithAuthorization for x402."""

import logging
import os
import time
import secrets
import json
import base64
from eth_account import Account
from web3 import Web3

log = logging.getLogger("x402_client")


# EIP-712 domain + type definitions for TransferWithAuthorization
def build_eip3009_authorization(
    *,
    from_address: str,
    to_address: str,
    value: int,           # USDC amount (6 decimals)
    usdc_contract: str,
    chain_id: int,
    token_name: str = "EURC",
    token_version: str = "2",
    valid_after: int | None = None,
    valid_before: int | None = None,
) -> tuple[dict, str]:
    """
    Build and sign an EIP-3009 authorization.
    Returns (authorization_dict, signature_hex).
    """
    private_key = os.environ["ARC_WALLET_PRIVATE_KEY"]
    now = int(time.time())
    if valid_after is None:
        valid_after = now - 60        # 1 minute in the past
    if valid_before is None:
        valid_before = now + 60       # 1 minute in the future (tight window)

    nonce = "0x" + secrets.token_hex(32)

    domain = {
        "name": token_name,
        "version": token_version,
        "chainId": chain_id,
        "verifyingContract": usdc_contract,
    }

    message = {
        "from": Web3.to_checksum_address(from_address),
        "to": Web3.to_checksum_address(to_address),
        "value": value,
        "validAfter": valid_after,
        "validBefore": valid_before,
        "nonce": bytes.fromhex(nonce[2:]),
    }

    structured_data = {
        "types": {
            "EIP712Domain": [
                {"name": "name", "type": "string"},
                {"name": "version", "type": "string"},
                {"name": "chainId", "type": "uint256"},
                {"name": "verifyingContract", "type": "address"},
            ],
            "TransferWithAuthorization": [
                {"name": "from", "type": "address"},
                {"name": "to", "type": "address"},
                {"name": "value", "type": "uint256"},
                {"name": "validAfter", "type": "uint256"},
                {"name": "validBefore", "type": "uint256"},
                {"name": "nonce", "type": "bytes32"},
            ],
        },
        "primaryType": "TransferWithAuthorization",
        "domain": domain,
        "message": message,
    }

    account = Account.from_key(private_key)
    log.info(f"wallet signing  from={account.address[:10]}…  to={to_address[:10]}…  amount={value}  chain={chain_id}")
    signed = Account.sign_typed_data(private_key, full_message=structured_data)

    authorization = {
        "from": Web3.to_checksum_address(from_address),
        "to": Web3.to_checksum_address(to_address),
        "value": str(value),
        "validAfter": str(valid_after),
        "validBefore": str(valid_before),
        "nonce": nonce,
    }

    return authorization, "0x" + signed.signature.hex()


def build_arc_payment_payload(
    requirements: dict,
    chain_id: int,
    token_name: str = "EURC",
) -> str:
    """
    Build a complete x402 PaymentPayload for Arc and return as base64.
    """
    from_private_key = os.environ["ARC_WALLET_PRIVATE_KEY"]
    account = Account.from_key(from_private_key)

    amount = int(requirements["maxAmountRequired"])
    usdc_contract = requirements["asset"]
    to_address = requirements["payTo"]

    authorization, signature = build_eip3009_authorization(
        from_address=account.address,
        to_address=to_address,
        value=amount,
        usdc_contract=usdc_contract,
        chain_id=chain_id,
        token_name=token_name,
    )

    payload = {
        "x402Version": 1,
        "scheme": "exact",
        "network": requirements["network"],
        "payload": {
            "signature": signature,
            "authorization": authorization,
        },
        "paymentRequirements": requirements,
    }

    return base64.b64encode(json.dumps(payload).encode()).decode()
