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
Logs: /tmp/pay_toll.log  |  Screenshots: /tmp/pay_toll_screenshots/
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
LOG_PATH = Path("/tmp/pay_toll.log")
SCREENSHOT_DIR = Path("/tmp/pay_toll_screenshots")
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(LOG_PATH, mode="w"),
    ],
)
log = logging.getLogger("pay_toll")
logging.getLogger("httpx").setLevel(logging.INFO)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("browser_use").setLevel(logging.DEBUG)   # all agent steps
logging.getLogger("langchain").setLevel(logging.INFO)
logging.getLogger("openai").setLevel(logging.WARNING)

from crypto_utils import generate_keypair, decrypt_card_credentials
from x402_client import X402Client

# ── Customer identity (used when merchants ask for personal details) ────────────
CUSTOMER = {
    "name":    "John Agent",
    "email":   "john.agent@505labs.com",
    "phone":   "+38631123123",
    "address": "Mestni trg 1",
    "city":    "Ljubljana",
    "country": "Slovenia",
    "zip":     "1000",
}


def make_llm():
    from langchain_openai import ChatOpenAI
    return ChatOpenAI(
        model=os.environ.get("GROK_MODEL", "grok-4.20-0309-non-reasoning"),
        api_key=os.environ.get("GROK_API_KEY"),
        base_url="https://api.x.ai/v1",
        temperature=0,
    )


async def run():
    merchant_url = os.environ.get("MERCHANT_URL", "https://demo-merchant-henna.vercel.app")
    task_goal    = os.environ.get("TASK", "pay the toll for the default route")
    headless     = os.environ.get("HEADLESS", "false").lower() == "true"
    chain        = os.environ.get("CHAIN", "arc-testnet")

    log.info("=" * 60)
    log.info("  TEE Card Issuer — Agentic Payment")
    log.info("=" * 60)
    log.info(f"  Merchant:   {merchant_url}")
    log.info(f"  Task:       {task_goal}")
    log.info(f"  Chain:      {chain}")
    log.info(f"  Headless:   {headless}")
    log.info(f"  Log:        {LOG_PATH}")
    log.info(f"  Screenshots:{SCREENSHOT_DIR}")
    log.info("=" * 60)

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
    # The agent handles everything from landing page to the card form.
    # It uses the dynamic TASK goal, fills in identity fields as needed,
    # and stops the moment it reaches a credit-card entry form.
    # It reports the total amount to pay so we can issue the exact card.
    log.info("[1/4] Shopping and advancing to payment form...")
    task_shop = f"""
You are a shopping agent. Navigate to {merchant_url} and complete this task:

GOAL: {task_goal}

General instructions:
- Browse the site as needed to accomplish the goal (find products, add to cart, etc.)
- During checkout, fill in any required fields using these customer details:
  {identity_block}
- Advance through all checkout steps (cart → contact info → shipping → payment)
- STOP as soon as you reach a credit card entry form (you will see a card number input or Stripe payment iframe)
- DO NOT fill in any card details
- When you stop, return ONLY this JSON:
  {{"amount_cents": <total in integer cents>, "currency": "EUR or USD", "description": "<what was bought>"}}
  Example: {{"amount_cents": 2999, "currency": "EUR", "description": "Blue cotton t-shirt M"}}
""".strip()

    agent_shop = Agent(task=task_shop, llm=make_llm(), browser_context=ctx, enable_memory=False)
    result_shop = await agent_shop.run(max_steps=25)
    result_str = str(result_shop)
    log.info(f"[1/4] Shop result: {result_str[:400]}")

    # Extract amount from result
    amount_cents = 0
    try:
        m = re.search(r'"amount_cents"\s*:\s*(\d+)', result_str)
        if m:
            amount_cents = int(m.group(1))
        else:
            m2 = re.search(r'[$€£]\s*(\d+)[.,](\d{2})', result_str)
            if m2:
                amount_cents = int(m2.group(1)) * 100 + int(m2.group(2))
    except Exception:
        pass

    if amount_cents <= 0:
        log.error("[1/4] Could not determine amount — aborting")
        await ctx.close()
        await browser.close()
        return False

    log.info(f"[1/4] Amount to pay: {amount_cents} cents (${amount_cents/100:.2f})")

    # ── Phase 2: Generate keypair + x402 → TEE → card ─────────────────────────
    log.info("[2/4] Generating ephemeral ECIES keypair...")
    private_key, public_key = generate_keypair()
    log.info(f"      Public key: {public_key[:16]}...{public_key[-8:]}")

    log.info(f"[2/4] Paying TEE via x402 for ${amount_cents/100:.2f} on {chain}...")
    client = X402Client(agent_pubkey=public_key, chain=chain)

    try:
        attestation = client.fetch_attestation()
        log.info(f"[2/4] TEE code_hash: {attestation.get('code_hash')}")
        log.info(f"[2/4] TEE pubkey:    {attestation.get('tee_pubkey')}")
    except Exception as e:
        log.warning(f"[2/4] Could not fetch TEE attestation: {e}")

    t0 = time.time()
    try:
        response = client.request_card(amount_usd_cents=amount_cents)
    except Exception as e:
        log.exception(f"Card request failed: {e}")
        await ctx.close()
        await browser.close()
        return False

    log.info(f"      TEE responded in {time.time()-t0:.2f}s — card: {response.get('card_id')}")

    encrypted_card = response.get("encrypted_card")
    if not encrypted_card:
        log.error(f"No encrypted_card in response: {response}")
        await ctx.close()
        await browser.close()
        return False

    log.info("[2/4] Decrypting card credentials...")
    try:
        card = decrypt_card_credentials(private_key, encrypted_card)
    except Exception as e:
        log.exception(f"Decryption failed: {e}")
        await ctx.close()
        await browser.close()
        return False

    log.info(f"      Card: **** **** **** {card.get('last4', '????')}")
    log.info(f"      Exp:  {card.get('exp_month'):02d}/{card.get('exp_year')}")

    # ── Phase 3+4: Fill card iframes + submit ─────────────────────────────────
    log.info("[3/4] Filling card form and submitting...")
    success = await _fill_and_pay(ctx, browser, card)

    log.info("=" * 60)
    if success:
        log.info("  ✓ END-TO-END COMPLETE")
        log.info(f"  {task_goal} → paid ${amount_cents/100:.2f} EURC → card issued → merchant paid")
    else:
        log.error("  ✗ Payment step failed — see screenshots in " + str(SCREENSHOT_DIR))
    log.info("=" * 60)

    return success


async def _wait_for_payment_outcome(page, wait_ms: int = 8000) -> bool:
    """
    Wait for the page to settle after payment submission, then ask the LLM once
    whether it succeeded or failed. Single call — no loop.
    """
    import json as _json
    from langchain_openai import ChatOpenAI

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

    llm = ChatOpenAI(
        model=os.environ.get("GROK_MODEL", "grok-4.20-0309-non-reasoning"),
        api_key=os.environ.get("GROK_API_KEY"),
        base_url="https://api.x.ai/v1",
        temperature=0,
    )
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
    from langchain_openai import ChatOpenAI

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
        log.error("[iframe-id] No inputs found in any iframe")
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

    llm = ChatOpenAI(
        model=os.environ.get("GROK_MODEL", "grok-4.20-0309-non-reasoning"),
        api_key=os.environ.get("GROK_API_KEY"),
        base_url="https://api.x.ai/v1",
        temperature=0,
    )

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
            inp = page.frame_locator(frame_sel).locator(input_sel)
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
        log.info("[3/4] Filling Stripe card fields via Playwright...")
        page = await ctx.get_current_page()

        await page.wait_for_timeout(3000)   # let Stripe iframes fully render
        await page.screenshot(path=str(SCREENSHOT_DIR / "before_fill.png"))
        log.info(f"[3/4] Current URL: {page.url}")

        fields = await _identify_card_fields(page)
        if not fields:
            log.error("[3/4] Could not identify card fields")
            await page.screenshot(path=str(SCREENSHOT_DIR / "fill_failed.png"))
            return False

        filled = await _fill_card_iframes(page, card, fields)
        if not filled:
            log.error("[3/4] Could not fill card iframes")
            await page.screenshot(path=str(SCREENSHOT_DIR / "fill_failed.png"))
            return False

        await page.wait_for_timeout(500)
        await page.screenshot(path=str(SCREENSHOT_DIR / "after_fill.png"))
        log.info("[3/4] Card fields filled ✓")

        # ── Phase 4: Click pay (one action), then LLM reads the outcome ───────
        task_pay = """
The credit card fields are already filled.
Do ONE thing only: find and click the payment submit button
(it may say "Pay", "Pay €...", "Place Order", "Submit", "Confirm", etc.).
Immediately call done() after clicking. Do NOT scroll or wait.
""".strip()

        log.info("[4/4] Clicking Pay button...")
        agent_pay = Agent(task=task_pay, llm=make_llm(), browser_context=ctx, enable_memory=False)
        await agent_pay.run(max_steps=4)
        log.info("[4/4] Pay clicked — checking outcome...")

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
    args = parser.parse_args()

    # CLI args override env vars
    if args.url:
        os.environ["MERCHANT_URL"] = args.url
    if args.task:
        os.environ["TASK"] = args.task
    if args.headless:
        os.environ["HEADLESS"] = "true"
    if args.chain:
        os.environ["CHAIN"] = args.chain

    ok = asyncio.run(run())
    sys.exit(0 if ok else 1)
