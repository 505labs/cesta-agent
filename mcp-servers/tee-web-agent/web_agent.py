#!/usr/bin/env python3
"""
TEE Web Agent — pay for anything on any merchant using crypto + a TEE-issued card.

Usage:
  pyenv exec python3 web_agent.py <url> "<task>"
  pyenv exec python3 web_agent.py https://cryptofy.5050sol.space/ "buy a shirt"
  pyenv exec python3 web_agent.py https://demo-merchant-henna.vercel.app "pay the A8 Cannes toll"

  HEADLESS=true pyenv exec python3 web_agent.py <url> "<task>"
  CHAIN=hedera-testnet pyenv exec python3 web_agent.py <url> "<task>"

CLI args override MERCHANT_URL / TASK env vars.
Logs: /tmp/agent_pay.log  |  Screenshots: /tmp/agent_pay_screenshots/
"""

import asyncio
import json
import logging
import os
import re
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

# ── Logging ────────────────────────────────────────────────────────────────────
LOG_PATH = Path("/tmp/agent_pay.log")
TEE_LOG_PATH = Path("/tmp/tee_pay.log")
SCREENSHOT_DIR = Path("/tmp/agent_pay_screenshots")
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(LOG_PATH, mode="w"),
    ],
)
log = logging.getLogger("agent_pay")

# x402_client logs go to a separate TEE log file
_tee_handler = logging.FileHandler(TEE_LOG_PATH, mode="w")
_tee_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s]  %(message)s", datefmt="%H:%M:%S"))
_tee_handler.setLevel(logging.INFO)
logging.getLogger("x402_client").addHandler(_tee_handler)
logging.getLogger("httpx").setLevel(logging.INFO)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("browser_use").setLevel(logging.DEBUG)   # all agent steps
logging.getLogger("langchain").setLevel(logging.INFO)
logging.getLogger("openai").setLevel(logging.WARNING)

from crypto_utils import generate_keypair, decrypt_card_credentials
from x402_client import X402Client

# ── Customer identity defaults (overridden by run() params) ───────────────────
CUSTOMER_DEFAULTS = {
    "first_name": "John",
    "last_name":  "Agent",
    "email":      "john.agent@505labs.com",
    "phone":      "+38631123123",
    "address":    "Mestni trg 1",
    "city":       "Ljubljana",
    "country":    "Slovenia",
    "zip":        "1000",
}


def make_llm():
    from langchain_openai import ChatOpenAI
    if os.environ.get("LLM_PROVIDER") == "0g":
        return ChatOpenAI(
            model=os.environ.get("ZG_LLM_MODEL", "qwen/qwen-2.5-7b-instruct"),
            api_key=os.environ.get("ZG_LLM_API_KEY"),
            base_url=os.environ.get("ZG_LLM_BASE_URL"),
            temperature=0,
        )
    from langchain_openai import ChatOpenAI
    return ChatOpenAI(
        model=os.environ.get("GROK_MODEL", "grok-4.20-0309-non-reasoning"),
        api_key=os.environ.get("GROK_API_KEY"),
        base_url="https://api.x.ai/v1",
        temperature=0,
    )


def make_vision_llm():
    """Return a vision-capable LLM via the configured OpenAI-compatible endpoint."""
    from langchain_openai import ChatOpenAI
    return ChatOpenAI(
        model=os.environ.get("VISION_LLM_MODEL", "gpt-5.4"),
        api_key=os.environ.get("VISION_LLM_API_KEY"),
        base_url=os.environ.get("VISION_LLM_BASE_URL", "https://llm.505labs.ai/v1"),
        temperature=0,
    )


async def run(
    url: str | None = None,
    task: str | None = None,
    chain: str | None = None,
    headless: bool | None = None,
    first_name: str | None = None,
    last_name: str | None = None,
    email: str | None = None,
    phone: str | None = None,
) -> dict | None:
    merchant_url = url  or os.environ.get("MERCHANT_URL", "https://demo-merchant-henna.vercel.app")
    task_goal    = task or os.environ.get("TASK", "pay the toll for the default route")
    headless     = headless if headless is not None else (os.environ.get("HEADLESS", "false").lower() == "true")
    chain        = chain or os.environ.get("CHAIN", "arc-testnet")

    CUSTOMER = {**CUSTOMER_DEFAULTS}
    if first_name: CUSTOMER["first_name"] = first_name
    if last_name:  CUSTOMER["last_name"]  = last_name
    if email:      CUSTOMER["email"]      = email
    if phone:      CUSTOMER["phone"]      = phone
    CUSTOMER["name"] = f"{CUSTOMER['first_name']} {CUSTOMER['last_name']}".strip()

    W = 62
    log.info("─" * W)
    log.info("  🤖  TEE Web Agent — Agentic Crypto Payment")
    log.info("─" * W)
    log.info(f"  🌐  Merchant : {merchant_url}")
    log.info(f"  🎯  Task     : {task_goal}")
    log.info(f"  ⛓️   Chain    : {chain}")
    log.info(f"  👤  Customer : {CUSTOMER['name']} <{CUSTOMER['email']}>")
    log.info("─" * W)

    from browser_use import Agent, Browser, BrowserConfig
    from browser_use.browser.context import BrowserContext
    browser = Browser(config=BrowserConfig(headless=headless))

    # ONE context for the entire session — never closed between steps
    ctx = BrowserContext(browser=browser)

    identity_block = (
        f"Name: {CUSTOMER['name']}, Email: {CUSTOMER['email']}, "
        f"Phone: {CUSTOMER['phone']}, Address: {CUSTOMER['address']}, "
        f"{CUSTOMER['zip']} {CUSTOMER['city']}, {CUSTOMER['country']}"
    )

    # ── Phase 1: Shop + reach payment form ────────────────────────────────────
    log.info("")
    log.info("  STEP 1/4 — 🛒  AI Agent is browsing the merchant...")
    log.info(f"             Goal: \"{task_goal}\"")
    task_shop = f"""
You are a shopping agent. Navigate to {merchant_url} and complete this task:

GOAL: {task_goal}

Step-by-step instructions:

STEP 1 — Find the product and add it to cart.

STEP 2 — Go to checkout. Fill in every required customer field:
  {identity_block}
  Always override the pre-selected country with {CUSTOMER['country']}.
  Verify each field is filled before moving on. Fix any validation errors that appear.

STEP 3 — Click the checkout submit button ("Place Order", "Pay", "Continue", etc.) once.
  If validation errors appear (missing fields, wrong format), fix them and click again.
  Keep fixing errors until the form accepts the entries.

STEP 4 — After no more billing/contact validation errors, call
  detect_payment_form. If it returns payment_form_detected=true, call done() immediately.

IMPORTANT: Ignore any payment branding or Stripe test-mode text visible on the page — those
appear alongside the billing form on some sites and do NOT mean you should stop early.
Only call done() after STEP 3 succeeds (billing accepted) AND STEP 4 confirms payment form.

When you call done(), pass ONLY this JSON (no other text):
  {{"amount_cents": <total in integer cents>, "currency": "EUR or USD", "description": "<what was bought>"}}
  Example: {{"amount_cents": 2999, "currency": "EUR", "description": "Blue cotton t-shirt M"}}
""".strip()

    # Register detect_payment_form as a custom Controller action
    from browser_use.controller.service import Controller
    import json as _json

    controller = Controller()

    @controller.action(
        "Inspect the current page for payment iframes and card input fields that may be "
        "invisible in the DOM snapshot (Stripe, Braintree, Adyen, etc.). "
        "Call this whenever you think you might be on the payment step. "
        "If it returns payment_form_detected=true, call done() immediately."
    )
    async def detect_payment_form() -> str:
        try:
            page = await ctx.get_current_page()

            # 1. Check iframes for payment processor signals
            iframes = await page.evaluate("""() =>
                Array.from(document.querySelectorAll('iframe')).map(f => ({
                    title: f.title || '',
                    src:   (f.src || '').substring(0, 120),
                    name:  f.name || '',
                    id:    f.id   || '',
                }))
            """)
            payment_keywords = [
                'stripe', 'braintree', 'adyen', 'square', 'paypal', 'checkout',
                'payment', 'card', 'secure', '__privateStripeFrame',
            ]
            flagged_iframes = [
                f for f in iframes
                if any(kw in (f['title']+f['src']+f['name']+f['id']).lower() for kw in payment_keywords)
            ]

            # 2. Check visible page text
            page_text = await page.evaluate("() => document.body.innerText")
            text_signals = [
                kw for kw in [
                    'card number', 'credit card', 'debit card', 'payment information',
                    'payment details', 'security code', 'cvv', 'cvc', 'expiry',
                    'expiration', 'test mode', 'payment incomplete', 'your card',
                ] if kw in page_text.lower()
            ]

            # 3. Check for inline card inputs
            inline_inputs = await page.evaluate("""() =>
                Array.from(document.querySelectorAll('input')).filter(el => {
                    const s = (el.name+el.placeholder+el.autocomplete+(el.getAttribute('aria-label')||'')).toLowerCase();
                    return s.includes('card') || s.includes('cvv') || s.includes('cvc') || s.includes('expir');
                }).length
            """)

            detected = bool(flagged_iframes or text_signals or inline_inputs)
            reason_parts = []
            if flagged_iframes:
                reason_parts.append(f"{len(flagged_iframes)} payment iframe(s): {[f['title'] or f['src'][:40] for f in flagged_iframes]}")
            if text_signals:
                reason_parts.append(f"page text: {text_signals}")
            if inline_inputs:
                reason_parts.append(f"{inline_inputs} inline card input(s)")

            result = {
                "payment_form_detected": detected,
                "reason": "; ".join(reason_parts) if reason_parts else "no payment form signals found",
                "iframes_found": len(iframes),
            }
            log.info(f"[detect_payment_form] detected={detected} — {result['reason']}")
            return _json.dumps(result)
        except Exception as e:
            log.warning(f"[detect_payment_form] error: {e}")
            return _json.dumps({"payment_form_detected": False, "reason": f"error: {e}"})

    agent_shop = Agent(
        task=task_shop,
        llm=make_llm(),
        browser_context=ctx,
        controller=controller,
        enable_memory=False,
        use_vision=True,
    )
    result_shop = await agent_shop.run(max_steps=35)
    # Use final_result() — the string passed to done() — then fall back to full repr
    result_str = result_shop.final_result() or str(result_shop)
    log.debug(f"[shop] Final result: {result_str[:400]}")

    # Extract amount from result
    amount_cents = 0
    description = ""
    currency = "EUR"
    try:
        m = re.search(r'"amount_cents"\s*:\s*(\d+)', result_str)
        if m:
            amount_cents = int(m.group(1))
        else:
            m2 = re.search(r'[$€£]\s*(\d+)[.,](\d{2})', result_str)
            if m2:
                amount_cents = int(m2.group(1)) * 100 + int(m2.group(2))
        md = re.search(r'"description"\s*:\s*"([^"]+)"', result_str)
        if md:
            description = md.group(1)
        mc = re.search(r'"currency"\s*:\s*"([^"]+)"', result_str)
        if mc:
            currency = mc.group(1).upper()
    except Exception:
        pass

    currency_symbol = "€" if currency == "EUR" else "$"
    # On-chain token label: Arc uses EURC for EUR, USDC for USD
    token = "EURC" if currency == "EUR" else "USDC"

    if amount_cents <= 0:
        log.error("  ❌  Could not determine checkout amount — aborting")
        await ctx.close()
        await browser.close()
        return None

    log.info(f"  ✅  Reached payment form — {description or 'item selected'}")
    log.info(f"             Total: {currency_symbol}{amount_cents/100:.2f} {currency}  ({amount_cents} cents)")

    # ── Phase 2: Generate keypair + x402 → TEE → card ─────────────────────────
    log.info("")
    log.info("  STEP 2/4 — 💳  Credit card required — requesting card via x402...")
    private_key, public_key = generate_keypair()

    client = X402Client(agent_pubkey=public_key, chain=chain)

    attestation = {}
    try:
        attestation = client.fetch_attestation()
        log.info(f"  🔍  TEE verified — code hash: {attestation.get('code_hash')}")
        log.info(f"             TEE pubkey : {attestation.get('tee_pubkey')}")
    except Exception as e:
        log.warning(f"  ⚠️   Could not fetch TEE attestation: {e}")

    log.info(f"  💸  Paying {currency_symbol}{amount_cents/100:.2f} {token} on-chain ({chain}) to receive a one-time card...")
    t0 = time.time()
    try:
        response = client.request_card(amount_usd_cents=amount_cents)
    except Exception as e:
        log.exception(f"  ❌  Card request failed: {e}")
        await ctx.close()
        await browser.close()
        return None

    elapsed = time.time() - t0
    receipt = response.get("receipt", {})
    tx_hash = receipt.get("tx_hash")
    card_id = response.get("card_id")

    log.info(f"  ✅  Payment settled in {elapsed:.2f}s — one-time card issued")
    if tx_hash:
        explorer = f"https://testnet.arcscan.app/tx/{tx_hash}" if "arc" in chain else f"https://hashscan.io/testnet/transaction/{tx_hash}"
        log.info(f"  ⛓️   On-chain tx  : {tx_hash}  {explorer}")
    log.info(f"  💳  Card          : {card_id}  (limit {currency_symbol}{receipt.get('card_spending_limit_cents', amount_cents)/100:.2f} — exactly what was paid)")
    log.info(f"  🔏  TEE signature : {response.get('tee_signature', 'N/A')[:40]}...")

    encrypted_card = response.get("encrypted_card")
    if not encrypted_card:
        log.error("  ❌  No encrypted_card in response")
        await ctx.close()
        await browser.close()
        return None

    log.info("  🔓  Decrypting card credentials with agent private key...")
    try:
        card = decrypt_card_credentials(private_key, encrypted_card)
    except Exception as e:
        log.exception(f"  ❌  Decryption failed: {e}")
        await ctx.close()
        await browser.close()
        return None

    log.info(f"  💳  Card ready    : **** **** **** {card.get('last4', '????')}  exp {card.get('exp_month'):02d}/{card.get('exp_year')}")

    # ── Phase 3+4: Fill card iframes + submit ─────────────────────────────────
    log.info("")
    log.info("  STEP 3/4 — 🖊️   Filling in card details and submitting payment...")
    success = await _fill_and_pay(ctx, browser, card)

    log.info("")
    W = 62
    if success:
        log.info("─" * W)
        log.info("  🎉  END-TO-END COMPLETE")
        log.info("─" * W)
        log.info(f"  Task     : {task_goal}")
        log.info(f"  Merchant : {merchant_url}")
        log.info(f"  Paid     : {currency_symbol}{amount_cents/100:.2f} {token} on {chain}")
        if tx_hash:
            log.info(f"  TX       : {tx_hash}  {explorer}")
        log.info(f"  Card     : {card_id}  (**** {card.get('last4', '????')})")
        log.info(f"  Customer : {CUSTOMER['name']} <{CUSTOMER['email']}>")
        log.info("")
        log.info("  How it works:")
        log.info("    1. AI agent browsed the merchant and reached the checkout")
        log.info(f"    2. Credit card required → paid {currency_symbol}{amount_cents/100:.2f} {token} on-chain via x402")
        log.info("    3. TEE verified the on-chain payment and issued a one-time Stripe card")
        log.info("       with a spending limit matching exactly what was paid")
        log.info("    4. Card details encrypted in the TEE — only this agent can decrypt them")
        log.info("    5. Agent filled in the card details and submitted the payment")
        log.info("    6. Card auto-cancels after one use — no double-spending possible")
        log.info("─" * W)

        # 0G summary — decentralised TEE inference narrates the result
        zg_summary = await _summarize_with_0g({
            "task": task_goal, "merchant": merchant_url,
            "amount": f"{currency_symbol}{amount_cents/100:.2f} {token}",
            "chain": chain, "tx_hash": tx_hash,
            "card_id": card_id, "card_last4": card.get("last4"),
            "customer": CUSTOMER["name"],
            "tee_pubkey": attestation.get("tee_pubkey"),
        })
        if zg_summary:
            log.info("")
            log.info("  🤖  0G TEE Inference Summary (qwen/qwen-2.5-7b-instruct):")
            for line in zg_summary.splitlines():
                log.info(f"      {line}")
            log.info("─" * W)

        return {
            "success": True,
            "task": task_goal,
            "merchant": merchant_url,
            "amount": f"{currency_symbol}{amount_cents/100:.2f} {token}",
            "chain": chain,
            "tx_hash": tx_hash,
            "tx_explorer": explorer if tx_hash else None,
            "card_id": card_id,
            "card_last4": card.get("last4"),
            "tee_pubkey": attestation.get("tee_pubkey"),
            "tee_signature": response.get("tee_signature"),
            "zg_summary": zg_summary,
        }
    else:
        log.error("─" * W)
        log.error("  ❌  Payment step failed")
        log.error(f"     Screenshots: {SCREENSHOT_DIR}")
        log.error("─" * W)
        return None


async def _summarize_with_0g(result: dict) -> str | None:
    """Call 0G decentralised TEE inference to narrate the completed transaction."""
    api_key = os.environ.get("ZG_LLM_API_KEY")
    base_url = os.environ.get("ZG_LLM_BASE_URL", "https://compute-network-6.integratenetwork.work/v1/proxy")
    model = os.environ.get("ZG_LLM_MODEL", "qwen/qwen-2.5-7b-instruct")
    if not api_key:
        return None
    try:
        import httpx
        prompt = (
            f"You are a concise transaction reporter. Summarise this completed agentic payment in 3-4 sentences, "
            f"highlighting the crypto payment, TEE security, and one-time card issuance:\n{result}"
        )
        resp = httpx.post(
            f"{base_url}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": model, "messages": [{"role": "user", "content": prompt}], "max_tokens": 200},
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        log.debug(f"[0g-summary] failed: {e}")
        return None


async def _wait_for_payment_outcome(page, wait_ms: int = 8000) -> bool:
    """
    Wait for the page to settle after payment submission, then ask the LLM once
    whether it succeeded or failed. Single call — no loop.
    """
    import json as _json

    log.info(f"[outcome] Waiting {wait_ms/1000:.0f}s for page to settle...")
    await page.wait_for_timeout(wait_ms)

    url = page.url
    # Grab visible page text (strips scripts/styles, keeps readable content)
    page_text = await page.evaluate("""() => {
        const clone = document.body.cloneNode(true);
        clone.querySelectorAll('script,style,noscript,iframe').forEach(e => e.remove());
        return clone.innerText.replace(/\\s+/g, ' ').trim().substring(0, 3000);
    }""")

    log.info(f"[outcome] Page after payment — URL: {url}")
    log.info(f"[outcome] Page text (first 300): {page_text[:300]}")

    prompt = f"""You are checking whether a payment just succeeded or failed.

Current URL: {url}
Page content:
{page_text}

Did the payment succeed?
Reply with ONLY valid JSON: {{"success": true, "reason": "one sentence"}}
or {{"success": false, "reason": "one sentence"}}"""

    llm = make_vision_llm()
    response = await llm.ainvoke(prompt)
    raw = response.content.strip()
    log.info(f"[outcome] LLM verdict: {raw}")

    try:
        m = re.search(r'\{.*\}', raw, re.DOTALL)
        verdict = _json.loads(m.group()) if m else {}
        success = bool(verdict.get("success"))
        reason = verdict.get("reason", "")
        if success:
            log.info(f"[outcome] ✓ Payment succeeded — {reason}")
        else:
            log.error(f"[outcome] ✗ Payment failed — {reason}")
        return success
    except Exception as e:
        log.error(f"[outcome] Could not parse LLM verdict: {e} — raw: {raw}")
        return False


async def _identify_card_fields(page) -> dict:
    """
    Enumerate all inputs inside all payment iframes, then use the LLM to map
    them to card_number / expiry / cvc.

    Returns a list of field descriptors:
      [{"frame_selector": "iframe[title='...']", "input_selector": "input[placeholder='...']",
        "field": "card_number"}, ...]
    """
    import json as _json

    # 1. Collect iframe metadata
    iframe_data = await page.evaluate("""() => {
        return Array.from(document.querySelectorAll('iframe')).map((f, i) => ({
            index: i,
            title: f.title || '',
            name: f.name || '',
            id: f.id || '',
            src: (f.src || '').substring(0, 120),
        }));
    }""")

    log.info(f"[iframe-id] Found {len(iframe_data)} iframes on page:")
    for f in iframe_data:
        log.info(f"[iframe-id]   [{f['index']}] title='{f['title']}' name='{f['name']}' src={f['src'][:60]}")

    if not iframe_data:
        log.warning("[iframe-id] No iframes found — payment form may not be loaded yet")
        return {}

    # 2. For each iframe, enumerate inputs inside it via Playwright
    frames_with_inputs = []
    for f in iframe_data:
        # Build a selector for the iframe
        if f['title']:
            frame_sel = f"iframe[title='{f['title']}']"
        elif f['name']:
            frame_sel = f"iframe[name='{f['name']}']"
        else:
            frame_sel = f"iframe:nth-child({f['index'] + 1})"

        try:
            fl = page.frame_locator(frame_sel)
            inputs = await fl.locator('input').all()
            input_data = []
            for inp in inputs:
                attrs = await inp.evaluate("""el => ({
                    name: el.name || '',
                    placeholder: el.placeholder || '',
                    autocomplete: el.autocomplete || '',
                    type: el.type || '',
                    'aria-label': el.getAttribute('aria-label') || '',
                    'data-elements-stable-field-name': el.getAttribute('data-elements-stable-field-name') || '',
                })""")
                input_data.append(attrs)
            if input_data:
                frames_with_inputs.append({"frame_selector": frame_sel, "inputs": input_data})
                log.info(f"[iframe-id] {frame_sel} → {len(input_data)} inputs: {input_data}")
        except Exception as e:
            log.debug(f"[iframe-id] Could not inspect {frame_sel}: {e}")

    if not frames_with_inputs:
        log.warning("[iframe-id] No inputs in any iframe — trying direct page inputs")
        # Fallback: card inputs embedded directly in the page (Shopify, Adyen, custom sites)
        direct_inputs = await page.evaluate("""() => {
            return Array.from(document.querySelectorAll('input')).map(el => ({
                name: el.name || '',
                placeholder: el.placeholder || '',
                autocomplete: el.autocomplete || '',
                type: el.type || '',
                id: el.id || '',
                'aria-label': el.getAttribute('aria-label') || '',
            }));
        }""")
        card_keywords = ['card', 'cc-', 'credit', 'debit', 'cvv', 'cvc', 'expir', 'pan']
        relevant = [i for i in direct_inputs if any(
            kw in (i.get('name','') + i.get('placeholder','') + i.get('autocomplete','') + i.get('aria-label','')).lower()
            for kw in card_keywords
        )]
        if relevant:
            log.info(f"[iframe-id] Found {len(relevant)} card-related inputs directly on page")
            frames_with_inputs.append({"frame_selector": None, "inputs": relevant})
        else:
            log.error("[iframe-id] No card inputs found anywhere on page")
            return {}

    # 3. Ask LLM to identify card_number / expiry / cvc
    prompt = f"""You are analysing input fields inside payment iframes on a checkout page.
Here is the list of iframes and their inputs (as JSON):
{_json.dumps(frames_with_inputs, indent=2)}

For each of these card fields, identify the best iframe and input selector:
- card_number  (16-digit credit/debit card number)
- expiry       (expiry date MM/YY)
- cvc          (3-4 digit security code)

Use the input's placeholder, autocomplete, aria-label, or data-elements-stable-field-name to identify it.
For the input_selector, prefer attribute selectors like:
  input[placeholder='1234 1234 1234 1234']
  input[autocomplete='cc-number']
  input[data-elements-stable-field-name='cardNumber']
If multiple inputs are in the same iframe, still include the correct frame_selector for each.

Return ONLY valid JSON — an object with exactly these keys (null if not found):
{{
  "card_number": {{"frame_selector": "iframe[title='...']", "input_selector": "input[...]"}},
  "expiry":      {{"frame_selector": "iframe[title='...']", "input_selector": "input[...]"}},
  "cvc":         {{"frame_selector": "iframe[title='...']", "input_selector": "input[...]"}}
}}"""

    llm = make_vision_llm()

    response = await llm.ainvoke(prompt)
    raw = response.content.strip()
    log.info(f"[iframe-id] LLM response: {raw}")

    m = re.search(r'\{.*\}', raw, re.DOTALL)
    if not m:
        log.error("[iframe-id] Could not parse JSON from LLM response")
        return {}

    try:
        fields = _json.loads(m.group())
        log.info(f"[iframe-id] Identified fields: {fields}")
        return fields
    except Exception as e:
        log.error(f"[iframe-id] JSON parse error: {e}")
        return {}


async def _fill_card_iframes(page, card: dict, fields: dict) -> bool:
    """Fill card fields using LLM-identified {frame_selector, input_selector} pairs."""
    from playwright.async_api import TimeoutError as PlaywrightTimeout

    exp_str = f"{card['exp_month']:02d} / {str(card['exp_year'])[-2:]}"

    fill_plan = [
        ("card_number", card['number']),
        ("expiry",      exp_str),
        ("cvc",         card['cvc']),
    ]

    for key, value in fill_plan:
        spec = fields.get(key)
        if not spec:
            log.warning(f"[iframe-fill] No field spec for '{key}' — skipping")
            continue

        frame_sel = spec.get("frame_selector")
        input_sel = spec.get("input_selector", "input")
        log.info(f"[iframe-fill] Filling '{key}': frame={frame_sel}  input={input_sel}")

        try:
            if frame_sel:
                inp = page.frame_locator(frame_sel).locator(input_sel)
            else:
                inp = page.locator(input_sel).first
            await inp.wait_for(state='visible', timeout=10000)
            await inp.click()
            await inp.fill(value)
            log.info(f"[iframe-fill] ✓ '{key}' = '{value[:4]}...'")
        except PlaywrightTimeout:
            log.error(f"[iframe-fill] Timeout on '{key}': {frame_sel} / {input_sel}")
            return False
        except Exception as e:
            log.exception(f"[iframe-fill] Error on '{key}': {e}")
            return False

    return True


async def _fill_and_pay(ctx, browser, card: dict) -> bool:
    """
    Phase 3: Playwright identifies and fills Stripe iframe card fields.
    Phase 4: browser-use clicks the pay button once; LLM reads the outcome.
    The page is already on the card form (Phase 1 stopped here).
    """
    from browser_use import Agent

    try:
        # ── Phase 3: Playwright fills card iframes ────────────────────────────
        log.info("  STEP 3/4 — 🖥️   Identifying payment iframes with LLM...")
        page = await ctx.get_current_page()

        await page.wait_for_timeout(3000)   # let Stripe iframes fully render
        await page.screenshot(path=str(SCREENSHOT_DIR / "before_fill.png"))
        log.info(f"             URL: {page.url}")

        fields = await _identify_card_fields(page)
        if not fields:
            log.error("[3/4] Could not identify card fields")
            await page.screenshot(path=str(SCREENSHOT_DIR / "fill_failed.png"))
            return False

        filled = await _fill_card_iframes(page, card, fields)
        if not filled:
            log.error("  ❌  Could not fill card iframes")
            await page.screenshot(path=str(SCREENSHOT_DIR / "fill_failed.png"))
            return False

        # Give Stripe JS time to register the filled values
        await page.wait_for_timeout(1200)
        await page.screenshot(path=str(SCREENSHOT_DIR / "after_fill.png"))
        log.info("  ✅  Card fields injected into payment form")

        # ── Phase 4: Click the pay/submit button ──────────────────────────────
        log.info("")
        log.info("  STEP 4/4 — 💳  Submitting payment...")
        page = await ctx.get_current_page()

        # Try known submit button selectors first (most reliable)
        submit_selectors = [
            "button[type=submit]",
            "input[type=submit]",
            "button:has-text('Pay now')",
            "button:has-text('Pay')",
            "button:has-text('Place Order')",
            "button:has-text('Complete Purchase')",
            "button:has-text('Complete Order')",
            "button:has-text('Confirm')",
            "button:has-text('Submit')",
            "button:has-text('Buy now')",
        ]
        clicked = False
        for sel in submit_selectors:
            try:
                btn = page.locator(sel).first
                if await btn.is_visible(timeout=1500):
                    await btn.scroll_into_view_if_needed()
                    await btn.click()
                    log.info(f"  ✅  Clicked submit button via selector: {sel}")
                    clicked = True
                    break
            except Exception:
                continue

        if not clicked:
            # Fallback: vision agent
            log.warning("  ⚠️  No submit button found via selectors — falling back to vision agent")
            task_pay = (
                "The credit card fields are already filled in. "
                "Find and click the payment submit button "
                "(e.g. 'Place Order', 'Pay', 'Complete Purchase', 'Confirm'). "
                "Fill in all required customer information fields before clicking the submit button. "
                "Click the actual submit/pay button once, then call done()."
            )
            agent_pay = Agent(task=task_pay, llm=make_vision_llm(), browser_context=ctx, enable_memory=False, use_vision=True)
            await agent_pay.run(max_steps=4)

        log.info("             Waiting for payment to process...")

        page = await ctx.get_current_page()
        success = await _wait_for_payment_outcome(page)

        try:
            await page.screenshot(path=str(SCREENSHOT_DIR / "final.png"))
        except Exception:
            pass

        return success

    except Exception as e:
        log.exception(f"_fill_and_pay error: {e}")
        return False
    finally:
        try:
            await ctx.close()
        except Exception:
            pass
        try:
            await browser.close()
        except Exception:
            pass


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="TEE Web Agent — pay for anything on any merchant using crypto.",
        usage="%(prog)s <url> <task> [options]",
    )
    parser.add_argument("url",  nargs="?", default=None, help="Merchant URL (overrides MERCHANT_URL env var)")
    parser.add_argument("task", nargs="?", default=None, help='What to buy, e.g. "buy a shirt"')
    parser.add_argument("--headless", action="store_true", help="Run browser headless")
    parser.add_argument("--chain", default=None, help="Payment chain (arc-testnet | hedera-testnet)")
    parser.add_argument("--debug", action="store_true", help="Enable DEBUG logging")
    args = parser.parse_args()

    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)
        logging.getLogger("agent_pay").setLevel(logging.DEBUG)
        logging.getLogger("x402_client").setLevel(logging.DEBUG)

    # CLI args override env vars
    if args.url:
        os.environ["MERCHANT_URL"] = args.url
    if args.task:
        os.environ["TASK"] = args.task
    if args.headless:
        os.environ["HEADLESS"] = "true"
    if args.chain:
        os.environ["CHAIN"] = args.chain

    result = asyncio.run(run())
    sys.exit(0 if result else 1)
