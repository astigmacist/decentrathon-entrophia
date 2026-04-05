# Bootstrap Manifest (Frozen)

This manifest freezes bootstrap parameters for the on-chain + API integration cycle.
After initial bootstrap, changes are allowed only through mini-RFC flow.

## Network

- `SOLANA_CLUSTER=devnet`
- `SOLANA_RPC_URL`
- `USDC_MINT`

## Program IDs

- `RECEIVABLES_PROGRAM_ID`
- `TRANSFER_HOOK_PROGRAM_ID`

## Role Wallets

- `ADMIN_WALLET`
- `VERIFIER_WALLET`
- `ATTESTOR_WALLET`
- Demo participants:
  - `ISSUER_WALLET`
  - `INVESTOR_A_WALLET`
  - `INVESTOR_B_WALLET`

## PDA Seeds (Frozen)

- `platform_config`
- `asset`
- `whitelist_entry`
- `investment_receipt`

## MVP Economic Constants (Frozen Defaults)

- `ASSET_TOKEN_DECIMALS=6`
- `DISCOUNT_BPS=9500`
- `FUNDING_TARGET_BPS=9500`
- `FUNDING_WINDOW_HOURS=48`

## Enum Contract

- `AssetStatus`: `Created`, `Verified`, `FundingOpen`, `Funded`, `Paid`, `Cancelled`, `Closed`
- `Role`: `Issuer`, `Investor`, `Verifier`, `Admin`, `Attestor`

## Acceptance Alignment (`domain-v1`)

This manifest must stay aligned with:

- `docs/architecture/domain-v1.md` statuses and role intent
- invariants:
  - post-`Verified` economic immutability
  - integer-only money values
  - no transfer after `Paid`
  - payout through claim + burn semantics

## Mini-RFC Change Rule

Any change after bootstrap requires one synchronized cycle:

1. Update this manifest.
2. Update on-chain constants/accounts/checks.
3. Update API config validation and handlers.
4. Update frontend/shared types.
5. Run seed/reset + demo flow.
6. Merge only after all integration checks pass.

## Day 6 Acceptance Mapping

- `AC-01/02`: create + verify + status change
  - `scripts/seed-demo/seed-asset.mjs`
  - `scripts/seed-demo/run-demo-flow.mjs`
  - `tests/anchor/day6-lifecycle.test.mjs`
- `AC-03`: funding + two investors buy
  - `scripts/seed-demo/run-demo-flow.mjs`
  - `tests/anchor/day6-lifecycle.test.mjs`
- `AC-04`: allowlisted secondary transfer success
  - `scripts/seed-demo/run-demo-flow.mjs`
  - `tests/anchor/transfer-hook-ac05.test.mjs`
- `AC-05`: non-allowlisted transfer fail
  - `tests/anchor/transfer-hook-ac05.test.mjs`
  - `tests/anchor/day6-lifecycle.test.mjs`
- `AC-06`: record payment and `Paid`
  - `services/api/src/settlement/settlement.service.ts`
  - `scripts/seed-demo/run-demo-flow.mjs`
- `AC-07`: holder claims
  - `services/api/src/claims/claims.service.ts`
  - `scripts/seed-demo/run-demo-flow.mjs`
- `AC-08`: outstanding `0` then finalize `Closed`
  - `services/api/src/settlement/settlement.service.ts`
  - `tests/anchor/day6-lifecycle.test.mjs`
- `AC-09`: setup/docs/IDs/demo command
  - `README.md`
  - `.env.example`
  - `services/api/.env.example`
  - `Anchor.toml`
