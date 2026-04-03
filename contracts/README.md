# GroupTreasury Smart Contract

Shared USDC treasury for group road trips. Members deposit USDC, an authorized agent spends from the pool within configurable limits, and settlement returns leftovers proportionally.

## Build & Test
```bash
forge build
forge test -vvv
```

## Deploy (local)
```bash
anvil &
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```
