#!/usr/bin/env bash
# Start Anvil with the deployer account pre-funded (1000 ETH)
#
# Usage: ./script/anvil.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../../.env"

DEPLOYER_ADDRESS=$(cast wallet address --private-key "$PRIVATE_KEY")

echo "Starting Anvil..."
echo "Deployer: $DEPLOYER_ADDRESS (1000 ETH)"

# --state lets you persist chain state across restarts (optional)
anvil \
  --balance 1000 \
  --accounts 1 \
  --mnemonic "test test test test test test test test test test test junk" \
  --state anvil-state.json \
  2>&1 &

ANVIL_PID=$!
sleep 1

# Fund the deployer from Anvil's default account (index 0)
DEFAULT_ACCOUNT=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
DEFAULT_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

echo "Funding deployer $DEPLOYER_ADDRESS with 100 ETH..."
cast send "$DEPLOYER_ADDRESS" \
  --value 100ether \
  --private-key "$DEFAULT_KEY" \
  --rpc-url http://127.0.0.1:8545 \
  > /dev/null 2>&1

BALANCE=$(cast balance "$DEPLOYER_ADDRESS" --rpc-url http://127.0.0.1:8545 --ether)
echo "Deployer balance: $BALANCE ETH"
echo ""
echo "Anvil running (PID: $ANVIL_PID). Press Ctrl+C to stop."

# Forward signals to Anvil
trap "kill $ANVIL_PID 2>/dev/null" EXIT
wait $ANVIL_PID
