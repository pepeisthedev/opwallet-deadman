# LegacyVaultStateMachine (OP_NET) MVP

This folder contains the OP_NET smart contract source for the Legacy Vault (Deadman Wallet) **policy/state machine** MVP.

## What It Does

- Stores vault policy (heirs + sharesBps)
- Stores inactivity policy (interval/grace)
- Tracks lifecycle: `ACTIVE -> TRIGGERED -> CLAIMED`
- Supports owner `checkIn`, public `trigger`, and `finalizeClaim(payoutRef)`
- Emits events for wallet/watchtower UI refresh

## What It Does Not Do (MVP)

- It does **not** enforce Bitcoin L1 Taproot custody
- It does **not** automatically move BTC
- `finalizeClaim` records policy finalization + `payoutRef` (e.g. txid/reference bytes)

## Timing Model

The contract uses `Blockchain.block.number` (block height) for deadline logic.

The ABI parameter names keep the original spec names (`intervalSec`, `graceSec`) for compatibility, but the runtime implementation treats them as **block-based units**. The wallet should convert UX time values to blocks before calling `createVault`.

## Can A Local Wallet Use A Testnet Deployment?

Yes.

A wallet UI running locally can interact with a deployed OP_NET testnet contract as long as:

1. The wallet network is set to `OPNET_TESTNET`
2. The contract address is configured in `opwallet/src/background/service/legacyVault/legacyVaultContractConfig.ts`
3. The wallet uses the ABI in `opwallet/src/shared/web3/abi/LEGACY_VAULT_STATE_MACHINE_ABI.ts`
4. The background service routes `legacyVault_*` actions to contract calls instead of the local mock `LegacyVaultService`

Local UI vs deployed contract is not a problem: the wallet talks to the contract over the configured OP_NET provider/RPC.

## Deploy / Integrate Checklist

1. Build contract bytecode (`.wasm`) with the OP_NET contract toolchain (`@btc-vision/btc-runtime` + transform/compiler)
2. Deploy to OP_NET testnet
3. Record the deployed contract P2OP address and ABI
4. Set the address in `legacyVaultContractConfig.ts`
5. Replace local Legacy Vault state transitions with contract calls + event/receipt parsing in the background service

## Build Contract WASM (for OP_WALLET Deploy Contract)

From this folder:

```bash
cd contracts/legacy-vault
npm install
npm run build:wasm
```

Output:

- `build/LegacyVaultStateMachine.wasm` (upload this in OP_WALLET's deploy contract flow)

Notes:

- `opnet compile` is for plugin `.opnet` binaries, not contract WASM.
- OP_WALLET's deploy flow uploads a file and uses its raw bytes as contract `bytecode`.
