# Deceathron Day 6 Runbook

This repository contains two Anchor programs, a NestJS API, and an indexer used for the Day 6 acceptance scope.

## Programs and Services

- `programs/receivables_program`
- `programs/transfer_hook_program`
- `services/api`
- `services/indexer`

## Quick Setup

1. Copy env files:
   - `cp .env.example .env`
   - `cp services/api/.env.example services/api/.env`
2. Replace placeholder addresses in both env files:
   - `USDC_MINT`
   - `RECEIVABLES_PROGRAM_ID`
   - `TRANSFER_HOOK_PROGRAM_ID`
   - all role wallets
3. Sync `Anchor.toml` `[programs.devnet]` IDs with deployed program IDs.
4. Start infra:
   - `docker compose -f docker/docker-compose.yml up -d`
5. Migrate DB:
   - `cd services/api && npm run db:migrate`
6. Start API (port `3001`) and indexer in separate terminals:
   - `cd services/api && npm run dev`
   - `cd services/indexer && npm run dev`
