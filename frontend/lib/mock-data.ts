import type { Asset, PortfolioItem, ActivityEvent, AssetDocument } from '@/types';

// ─── Mock Assets ──────────────────────────────────────────────────────────────
export const MOCK_ASSETS: Asset[] = [
  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    issuerWallet: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAs',
    status: 'FundingOpen',
    faceValue: 10_000_000_000,   // 10,000 USDC (6 decimals)
    discountBps: 500,
    fundingTarget:  9_500_000_000,
    fundingRaised:  6_650_000_000,
    dueDateTs: Math.floor(Date.now() / 1000) + 30 * 86400, // 30 days
    debtorRefHash: 'YWNtZS1jb3Jwb3JhdGlvbg==',
    invoiceHash: 'sha256:4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b',
    metadataUri: 'https://arweave.net/factora-meta-1',
    mint: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    createdAt: new Date(Date.now() - 5 * 86400_000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86400_000).toISOString(),
  },
  {
    id: 'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    issuerWallet: '9yMXug3DX98e08UYKTEqcE6kbfLiMbkVoJAsgBt4hBv',
    status: 'FundingOpen',
    faceValue: 25_000_000_000,   // 25,000 USDC
    discountBps: 350,
    fundingTarget: 24_125_000_000,
    fundingRaised: 18_900_000_000,
    dueDateTs: Math.floor(Date.now() / 1000) + 45 * 86400,
    debtorRefHash: 'dGVjaC1zb2x1dGlvbnM=',
    invoiceHash: 'sha256:9f8e7d6c5b4a3c2d1e0f9a8b7c6d5e4f3a2b1c0',
    metadataUri: 'https://arweave.net/factora-meta-2',
    mint: 'So11111111111111111111111111111111111111112',
    createdAt: new Date(Date.now() - 8 * 86400_000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 86400_000).toISOString(),
  },
  {
    id: 'c3d4e5f6-a7b8-9012-cdef-345678901234',
    issuerWallet: 'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUu',
    status: 'Verified',
    faceValue: 5_000_000_000,   // 5,000 USDC
    discountBps: 600,
    fundingTarget: 4_700_000_000,
    fundingRaised: 0,
    dueDateTs: Math.floor(Date.now() / 1000) + 20 * 86400,
    debtorRefHash: 'ZGVzaWduLXN0dWRpbw==',
    invoiceHash: 'sha256:1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
    metadataUri: 'https://arweave.net/factora-meta-3',
    createdAt: new Date(Date.now() - 2 * 86400_000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 86400_000).toISOString(),
  },
  {
    id: 'd4e5f6a7-b8c9-0123-defa-456789012345',
    issuerWallet: 'VvWwXxYyZzAaBbCcDdEeFfGgHhIiJjKkLlMmNnOo',
    status: 'Funded',
    faceValue: 50_000_000_000,   // 50,000 USDC
    discountBps: 450,
    fundingTarget: 47_750_000_000,
    fundingRaised: 47_750_000_000,
    dueDateTs: Math.floor(Date.now() / 1000) + 10 * 86400,
    debtorRefHash: 'bG9naXN0aWNzLWNvcnA=',
    invoiceHash: 'sha256:2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c',
    metadataUri: 'https://arweave.net/factora-meta-4',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    createdAt: new Date(Date.now() - 15 * 86400_000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 86400_000).toISOString(),
  },
  {
    id: 'e5f6a7b8-c9d0-1234-efab-567890123456',
    issuerWallet: 'PpQqRrSsTtUuVvWwXxYyZzAaBbCcDdEeFfGgHhIi',
    status: 'Paid',
    faceValue: 15_000_000_000,   // 15,000 USDC
    discountBps: 700,
    fundingTarget: 13_950_000_000,
    fundingRaised: 13_950_000_000,
    dueDateTs: Math.floor(Date.now() / 1000) - 5 * 86400,
    debtorRefHash: 'cmV0YWlsLWNoYWlu',
    invoiceHash: 'sha256:3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d',
    metadataUri: 'https://arweave.net/factora-meta-5',
    mint: 'GkE22Vfb6TzFBxNVqJvMgpLdTCRKzFqXyPwHJm5NBnJ',
    createdAt: new Date(Date.now() - 40 * 86400_000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 86400_000).toISOString(),
  },
  {
    id: 'f6a7b8c9-d0e1-2345-fabc-678901234567',
    issuerWallet: 'KkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZzAaBbCcDd',
    status: 'FundingOpen',
    faceValue: 8_000_000_000,    // 8,000 USDC
    discountBps: 400,
    fundingTarget: 7_680_000_000,
    fundingRaised: 2_100_000_000,
    dueDateTs: Math.floor(Date.now() / 1000) + 60 * 86400,
    debtorRefHash: 'c29mdHdhcmUtaW5j',
    invoiceHash: 'sha256:4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e',
    metadataUri: 'https://arweave.net/factora-meta-6',
    createdAt: new Date(Date.now() - 3 * 86400_000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 86400_000).toISOString(),
  },
];

// ─── Mock Portfolio ───────────────────────────────────────────────────────────
export const MOCK_PORTFOLIO: PortfolioItem[] = [
  {
    asset: MOCK_ASSETS[0],
    tokenBalance: 3_500,
    contributedUsdc: 3_325_000_000,
    expectedPayout: 3_500_000_000,
    refunded: false,
  },
  {
    asset: MOCK_ASSETS[3],
    tokenBalance: 10_000,
    contributedUsdc: 9_550_000_000,
    expectedPayout: 10_000_000_000,
    refunded: false,
  },
  {
    asset: MOCK_ASSETS[4],
    tokenBalance: 5_000,
    contributedUsdc: 4_650_000_000,
    expectedPayout: 5_000_000_000,
    refunded: false,
  },
];

// ─── Mock Activity ────────────────────────────────────────────────────────────
export const MOCK_ACTIVITY: ActivityEvent[] = [
  {
    id: 'ev1',
    assetId: MOCK_ASSETS[0].id,
    action: 'create_asset',
    actorWallet: MOCK_ASSETS[0].issuerWallet,
    txSignature: '5vVH2hnxG3kn6V8D9mGC2fJqT1yWnL7ZxBpA4eKQXjNsPaH1cMbRn3dFqwT',
    createdAt: new Date(Date.now() - 5 * 86400_000).toISOString(),
  },
  {
    id: 'ev2',
    assetId: MOCK_ASSETS[0].id,
    action: 'verify_asset',
    actorWallet: '3vVH2hnxG3kn6V8D9mGC2fJqT1yWnL7ZxBpA4eKQXjN',
    txSignature: 'KsPaH1cMbRn3dFqwT5vVH2hnxG3kn6V8D9mGC2fJqT1',
    createdAt: new Date(Date.now() - 3 * 86400_000).toISOString(),
  },
  {
    id: 'ev3',
    assetId: MOCK_ASSETS[0].id,
    action: 'open_funding',
    actorWallet: 'AdminWallet1111111111111111111111111111111',
    txSignature: 'yWnL7ZxBpA4eKQXjNsPaH1cMbRn3dFqwT5vVH2hnxG3',
    createdAt: new Date(Date.now() - 2 * 86400_000).toISOString(),
  },
  {
    id: 'ev4',
    assetId: MOCK_ASSETS[0].id,
    action: 'buy_primary',
    actorWallet: 'InvestorWallet111111111111111111111111111111',
    txSignature: 'kn6V8D9mGC2fJqT1yWnL7ZxBpA4eKQXjNsPaH1cMb',
    payload: { amount: 3_325_000_000 },
    createdAt: new Date(Date.now() - 1 * 86400_000).toISOString(),
  },
];

// ─── Mock Documents ───────────────────────────────────────────────────────────
export const MOCK_DOCUMENTS: AssetDocument[] = [
  {
    id: 'doc1',
    assetId: MOCK_ASSETS[0].id,
    filename: 'invoice-ACME-2026-001.pdf',
    fileUri: '#',
    contentHash: 'sha256:4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4a3b2c1d',
    kind: 'invoice',
    uploadedAt: new Date(Date.now() - 5 * 86400_000).toISOString(),
  },
  {
    id: 'doc2',
    assetId: MOCK_ASSETS[0].id,
    filename: 'service-contract-2026.pdf',
    fileUri: '#',
    contentHash: 'sha256:9f8e7d6c5b4a3c2d1e0f9a8b7c6d5e4f3a2b1c09f8e7d6c5',
    kind: 'contract',
    uploadedAt: new Date(Date.now() - 5 * 86400_000).toISOString(),
  },
];

// ─── Marketplace Stats ────────────────────────────────────────────────────────
export const MOCK_STATS = {
  totalAssets: 24,
  activeFunding: 8,
  totalVolume: 485_000_000_000,  // 485k USDC
  totalInvestors: 142,
};
