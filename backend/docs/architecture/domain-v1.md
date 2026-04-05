# Domain Model v1 (Frozen)

This document freezes the v1 domain contract for the RWA Receivables MVP.
Any change to these definitions must be explicitly coordinated across on-chain,
API, indexer, and frontend before implementation.

## AssetStatus

Canonical lifecycle status enum:

- `Created`
- `Verified`
- `FundingOpen`
- `Funded`
- `Paid`
- `Cancelled`
- `Closed`

Allowed transitions:

- `Created -> Verified`
- `Verified -> FundingOpen`
- `FundingOpen -> Funded`
- `FundingOpen -> Cancelled`
- `Funded -> Paid`
- `Paid -> Closed`

Terminal statuses:

- `Cancelled`
- `Closed`

## Roles

Canonical role enum:

- `Issuer`
- `Investor`
- `Verifier`
- `Admin`
- `Attestor`

Role intent:

- `Issuer`: creates asset drafts and provides invoice documents.
- `Investor`: participates in funding and claims payout.
- `Verifier`: reviews documents and confirms eligibility.
- `Admin`: manages platform-level operations and lifecycle controls.
- `Attestor`: records repayment evidence for settlement.

## Core On-Chain Entities (API Contract Level)

### PlatformConfig

Represents global platform configuration and authorities.

Expected fields (contract-level):

- `admin`
- `verifier_authority`
- `attestor_authority`
- `usdc_mint`
- `platform_fee_bps`
- `paused`

### Asset

Represents one tokenized invoice / receivable.

Expected fields (contract-level):

- `asset_id`
- `issuer`
- `invoice_hash`
- `metadata_uri`
- `debtor_ref_hash`
- `face_value`
- `discount_bps`
- `funding_target`
- `due_date`
- `status`
- `mint`

### WhitelistEntry

Represents wallet-level allowlist + role constraints.

Expected fields (contract-level):

- `wallet`
- `role_mask`
- `active`
- `kyc_ref_hash`
- `updated_at`

### InvestmentReceipt

Represents investor contribution accounting per asset.

Expected fields (contract-level):

- `asset`
- `investor`
- `contributed_usdc`
- `received_asset_tokens`
- `refunded`

## Invariants (Must Hold)

1. After `Verified`, asset economic parameters are immutable:
   - `invoice_hash`
   - `metadata_uri`
   - `debtor_ref_hash`
   - `face_value`
   - `discount_bps`
   - `funding_target`
   - `due_date`
2. Monetary values are stored and processed only as integer base units.
3. Any token transfer after `Paid` is prohibited.
4. Payout is executed through claim with token burn semantics.

## Freeze Policy

This file is the source of truth for v1 domain boundaries.
If any item changes, update this file first and then apply synchronized changes
to all dependent components in one integration cycle.
