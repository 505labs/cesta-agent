#!/usr/bin/env python3
"""
tee-web-agent MCP server — exposes the TEE web agent as an MCP tool for Claude.

Start: python mcp_server.py
Register: claude mcp add tee-web-agent -- python /path/to/mcp_server.py
"""
from pathlib import Path
from dotenv import load_dotenv

# Load .env before importing web_agent (which also loads it, but be explicit)
load_dotenv(Path(__file__).parent / ".env")

import logging
from mcp.server.fastmcp import FastMCP
from web_agent import run

mcp = FastMCP("tee-web-agent")


@mcp.tool()
async def pay(
    url: str,
    task: str,
    chain: str = "arc-testnet",
    headless: bool = False,
    debug: bool = False,
    first_name: str = "",
    last_name: str = "",
    email: str = "",
    phone: str = "",
) -> str:
    """
    Have the TEE web agent pay for something on a merchant website using crypto.

    The agent will:
    1. Browse the merchant site and complete checkout up to the payment form
    2. Pay the exact amount on-chain (EURC/USDC) via x402 to receive a TEE-issued one-time Stripe card
    3. Fill in the card details automatically and submit the payment

    Security guarantees:
    - Payment verified on-chain before card is issued
    - Card spending limit matches payment exactly (enforced by Stripe)
    - Card credentials encrypted in TEE — only this agent can decrypt them
    - Receipt signed by TEE key (verifiable via ecrecover)
    - Card auto-cancels after one use

    Args:
        url:        Merchant website URL (e.g. "https://cryptofy.5050sol.space/")
        task:       What to buy in natural language (e.g. "buy a toll from Cannes to Monaco")
        chain:      Payment chain — "arc-testnet" (default) or "hedera-testnet"
        headless:   Run browser in headless mode, default False
        debug:      Enable verbose DEBUG logging, default False
        first_name: Customer first name (default: "John")
        last_name:  Customer last name (default: "Agent")
        email:      Customer email address
        phone:      Customer phone number
    """
    if debug:
        logging.getLogger().setLevel(logging.DEBUG)
    result = await run(
        url=url, task=task, chain=chain, headless=headless,
        first_name=first_name or None,
        last_name=last_name or None,
        email=email or None,
        phone=phone or None,
    )

    if not result:
        return "❌ Payment failed. Check the TEE server is running at TEE_SERVER_URL and the wallet has sufficient funds."

    lines = [
        "🎉 Payment complete!",
        f"  Task     : {result['task']}",
        f"  Merchant : {result['merchant']}",
        f"  Paid     : {result['amount']} on {result['chain']}",
    ]
    if result.get("tx_hash"):
        explorer = result.get("tx_explorer", "")
        tx_line = f"  TX       : {result['tx_hash']}"
        if explorer:
            tx_line += f"\n             {explorer}"
        lines.append(tx_line)
    lines += [
        f"  Card     : {result['card_id']}  (**** {result['card_last4']})",
        f"  TEE key  : {result['tee_pubkey']}",
        f"  TEE sig  : {result['tee_signature'][:40] if result.get('tee_signature') else 'N/A'}...",
    ]
    if result.get("zg_summary"):
        lines += ["", f"  0G Summary: {result['zg_summary']}"]
    return "\n".join(lines)


def _start_log_server():
    """Start the log streaming server in the background and open browser."""
    import subprocess, socket, time
    PORT = 4242
    # Check if already running
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        if s.connect_ex(("localhost", PORT)) == 0:
            return  # already up
    log_server = Path(__file__).parent / "log_server.py"
    subprocess.Popen(
        [__import__("sys").executable, str(log_server), "--port", str(PORT)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(0.5)
    # Open browser in subprocess to avoid osascript noise on stdout (MCP stdio transport)
    try:
        import webbrowser, os, sys
        # Redirect stdout temporarily to avoid corrupting MCP stdio
        devnull = os.open(os.devnull, os.O_WRONLY)
        old_stdout = os.dup(1)
        os.dup2(devnull, 1)
        try:
            webbrowser.open(f"http://localhost:{PORT}")
        finally:
            os.dup2(old_stdout, 1)
            os.close(devnull)
            os.close(old_stdout)
    except Exception:
        pass  # non-critical


if __name__ == "__main__":
    _start_log_server()
    mcp.run(transport="stdio")
