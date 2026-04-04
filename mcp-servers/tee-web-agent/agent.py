"""
TEE Card Issuer — Web Agent

Full demo flow:
  1. Generate ECIES keypair
  2. Request one-time card from TEE server via x402
     - Pay USDC on Arc (or HBAR on Hedera) to the TEE
     - TEE verifies on-chain, issues Stripe virtual card, returns encrypted credentials
  3. Decrypt card credentials with agent's private key
  4. Use browser-use (Claude-powered) to fill card into demo merchant checkout
"""

import asyncio
import os
import json
from dotenv import load_dotenv

load_dotenv()

from crypto_utils import generate_keypair, decrypt_card_credentials
from x402_client import X402Client
from browser import inject_card_into_checkout


async def main():
    chain = os.environ.get("CHAIN", "arc-testnet")
    amount_cents = int(os.environ.get("AMOUNT_USD_CENTS", "1000"))
    merchant_url = os.environ.get("MERCHANT_URL", "http://localhost:3001")

    print("=" * 55)
    print("  TEE One-Time Card Issuer — Demo Agent")
    print("=" * 55)
    print(f"  Chain:    {chain}")
    print(f"  Amount:   ${amount_cents / 100:.2f} USD")
    print(f"  Merchant: {merchant_url}")
    print("=" * 55)

    # Step 1: Generate ephemeral keypair for this session
    print("\n[1/4] Generating ephemeral ECIES keypair...")
    private_key, public_key = generate_keypair()
    print(f"      Public key: {public_key[:20]}...{public_key[-8:]}")

    # Step 2: Request card from TEE via x402
    print(f"\n[2/4] Requesting one-time card via x402 ({chain})...")
    client = X402Client(agent_pubkey=public_key, chain=chain)

    try:
        response = client.request_card(amount_usd_cents=amount_cents)
    except Exception as e:
        print(f"\n[ERROR] Card request failed: {e}")
        return

    encrypted_card = response.get("encrypted_card")
    card_id = response.get("card_id")
    expires_in = response.get("expires_in_seconds", 600)

    if not encrypted_card:
        print(f"[ERROR] No encrypted_card in response: {response}")
        return

    print(f"      Card ID:    {card_id}")
    print(f"      Expires in: {expires_in}s")

    # Step 3: Decrypt card credentials
    print(f"\n[3/4] Decrypting card credentials...")
    try:
        card = decrypt_card_credentials(private_key, encrypted_card)
    except Exception as e:
        print(f"[ERROR] Decryption failed: {e}")
        return

    print(f"      Card: **** **** **** {card.get('last4')}")
    print(f"      Exp:  {card.get('exp_month'):02d}/{card.get('exp_year')}")
    print(f"      [credentials never logged to disk or network]")

    # Step 4: Use browser-use to fill card into merchant checkout
    print(f"\n[4/4] Injecting card into checkout via browser-use agent...")
    success = await inject_card_into_checkout(
        checkout_url=merchant_url,
        card=card,
        headless=os.environ.get("HEADLESS", "false").lower() == "true",
    )

    print("\n" + "=" * 55)
    if success:
        print("  ✓ END-TO-END DEMO COMPLETE")
        print(f"  Paid ${amount_cents / 100:.2f} crypto → got card → paid merchant")
    else:
        print("  ✗ Browser payment step failed")
        print("  (Check merchant is running at", merchant_url, ")")
    print("=" * 55)


if __name__ == "__main__":
    asyncio.run(main())
