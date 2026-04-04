"""browser-use agent — LLM-powered checkout navigation and card injection.

Supports multiple LLM providers via LLM_PROVIDER env var:
  - "grok"      → xAI Grok (OpenAI-compatible, needs GROK_API_KEY)
  - "anthropic" → Claude (needs ANTHROPIC_API_KEY)
  - "openai"    → OpenAI (needs OPENAI_API_KEY)
Default: grok
"""

import asyncio
import os
from browser_use import Agent, BrowserConfig, Browser


def get_llm():
    provider = os.environ.get("LLM_PROVIDER", "grok").lower()

    if provider == "grok":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=os.environ.get("GROK_MODEL", "grok-4.20-0309-non-reasoning"),
            api_key=os.environ.get("GROK_API_KEY"),
            base_url="https://api.x.ai/v1",
            temperature=0,
        )
    elif provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(
            model=os.environ.get("ANTHROPIC_MODEL", "claude-opus-4-6"),
            api_key=os.environ.get("ANTHROPIC_API_KEY"),
            temperature=0,
        )
    elif provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=os.environ.get("OPENAI_MODEL", "gpt-4o"),
            api_key=os.environ.get("OPENAI_API_KEY"),
            temperature=0,
        )
    else:
        raise ValueError(f"Unknown LLM_PROVIDER: {provider}. Use: grok, anthropic, openai")


async def inject_card_into_checkout(
    checkout_url: str,
    card: dict,
    headless: bool = False,
) -> bool:
    """
    Use browser-use (LLM-powered) to navigate to a checkout page and fill in
    the provided card credentials.

    Args:
        checkout_url: URL of the checkout page
        card: dict with keys: number, cvc, exp_month, exp_year
        headless: whether to run browser headlessly

    Returns:
        True if payment appeared to succeed, False otherwise
    """
    exp_str = f"{card['exp_month']:02d}/{str(card['exp_year'])[-2:]}"

    task = (
        f"Navigate to {checkout_url}. "
        f"Find the credit card payment form on the page. "
        f"Fill in the following card details:\n"
        f"  - Card number: {card['number']}\n"
        f"  - Expiry: {exp_str}\n"
        f"  - CVC/CVV: {card['cvc']}\n"
        f"Submit the payment form and confirm whether the payment succeeded or failed. "
        f"Return 'SUCCESS' if the payment went through, or 'FAILED: <reason>' if it did not."
    )

    llm = get_llm()
    provider = os.environ.get("LLM_PROVIDER", "grok")
    print(f"[browser-use] Using LLM provider: {provider}")

    browser = Browser(config=BrowserConfig(headless=headless))

    agent = Agent(
        task=task,
        llm=llm,
        browser=browser,
    )

    print(f"[browser-use] Navigating to {checkout_url} to fill card **** {card.get('last4', '****')}")

    try:
        result = await agent.run(max_steps=20)
        final_output = str(result)
        print(f"[browser-use] Result: {final_output}")
        return "SUCCESS" in final_output.upper()
    except Exception as e:
        print(f"[browser-use] Error: {e}")
        return False
    finally:
        await browser.close()


if __name__ == "__main__":
    test_card = {
        "number": "4242424242424242",
        "cvc": "123",
        "exp_month": 12,
        "exp_year": 2028,
        "last4": "4242",
    }
    merchant_url = os.environ.get("MERCHANT_URL", "http://localhost:3001")
    success = asyncio.run(inject_card_into_checkout(merchant_url, test_card, headless=False))
    print(f"Payment {'succeeded' if success else 'failed'}")
