# Factora — RWA Receivables Frontend

> National Solana Hackathon by Decentrathon · Case 1 · Tokenization of Real-World Assets

Web frontend for the **Factora RWA Receivables** platform — a Solana-based system for tokenizing verified invoices and enabling fractional investment in real-world receivables.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 |
| Wallet | `@solana/wallet-adapter-react` (Phantom, Solflare) |
| On-chain | `@coral-xyz/anchor` + Token-2022 |
| Data Fetching | `@tanstack/react-query` |
| Notifications | `sonner` |
| Icons | `lucide-react` |

---

## Getting Started

```bash
# 1. Install dependencies
cd apps/web
npm install

# 2. Copy env file
cp .env.example .env.local
# Then edit .env.local with your values

# 3. Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

```env
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_API_URL=http://localhost:3001      # Backend API URL
NEXT_PUBLIC_PROGRAM_ID=<deployed_program_id>   # Anchor program on devnet
NEXT_PUBLIC_USDC_MINT=<usdc_mint_devnet>       # USDC mint address on devnet
```

---

## Pages & Roles

| Route | Role | Description |
|---|---|---|
| `/marketplace` | All | Browse tokenized invoices |
| `/asset/[id]` | All | Asset details + invest |
| `/submit` | Issuer | Create new invoice asset |
| `/portfolio` | Investor | Holdings, claim payout, transfer |
| `/verifier` | Verifier | Review queue + allowlist |
| `/admin` | Admin | Open/close funding, record repayment |

---

## Architecture

```
apps/web/
  app/              # Next.js App Router pages
  components/       # Reusable UI components
    navigation.tsx        # Role-aware nav bar with Factora logo
    status-badge.tsx      # 7 asset statuses with color coding
    tx-button.tsx         # Button with idle/pending/confirmed/failed states
    asset-card.tsx        # Marketplace card component
    activity-timeline.tsx # On-chain event history
  hooks/
    useRole.ts       # Reads wallet → fetches role from backend
    useAsset.ts      # Asset data fetching
    usePortfolio.ts  # Portfolio scoped to connected wallet
  lib/
    solana.ts        # Connection, utils (formatUsdc, calcYield, etc.)
    api.ts           # Backend API client (all fetch wrappers)
    anchor.ts        # Anchor program stubs (replace with IDL)
    utils.ts         # cn() utility
  types/
    index.ts         # Shared TypeScript types
```

---

## Integration with Backend

The frontend coordinates with the backend via `NEXT_PUBLIC_API_URL`.  
Key endpoints expected:

```
GET  /api/marketplace
GET  /api/assets/:id
GET  /api/assets/:id/documents
GET  /api/portfolio/:wallet
GET  /api/review-queue
POST /api/assets
POST /api/assets/:id/documents
POST /api/assets/:id/verify
POST /api/whitelist
POST /api/assets/:id/open-funding
POST /api/assets/:id/close-funding
POST /api/assets/:id/record-payment
GET  /api/activity/:assetId
GET  /api/users/:wallet
```

---

## On-chain Integration TODO

Once the Anchor program is deployed, update `lib/anchor.ts` stubs:

1. Share the IDL file from `programs/receivables_program/target/idl/`  
2. Set `NEXT_PUBLIC_PROGRAM_ID` in `.env.local`  
3. Replace stub functions in `lib/anchor.ts` with real Anchor calls

---

## Demo Asset (from ТЗ)

| Parameter | Value |
|---|---|
| Invoice nominal | 10,000 USDC |
| Discount | 5% |
| Funding target | 9,500 USDC |
| Investor A | 6,000 INV |
| Investor B | 4,000 INV |
| Secondary transfer | A → B: 1,000 INV |
| Expected payout A | 5,000 USDC |
| Expected payout B | 5,000 USDC |
