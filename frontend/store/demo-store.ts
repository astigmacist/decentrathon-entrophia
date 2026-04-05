'use client';

import { create } from 'zustand';
import {
  MOCK_ACTIVITY,
  MOCK_ASSETS,
  MOCK_DOCUMENTS,
  MOCK_PORTFOLIO,
} from '@/lib/mock-data';
import type {
  ActivityEvent,
  Asset,
  AssetDocument,
  AssetStatus,
  PaymentRecord,
  PortfolioItem,
  ReviewAction,
  WhitelistEntry,
} from '@/types';

interface CreateDemoAssetInput {
  issuerWallet: string;
  faceValue: number;
  discountBps: number;
  dueDateTs: number;
  debtorRefHash: string;
  invoiceHash: string;
}

interface InvestDemoInput {
  assetId: string;
  investorWallet: string;
  amount: number;
}

interface VerifyDemoInput {
  assetId: string;
  verifierWallet: string;
  decision: 'approved' | 'rejected';
  comment?: string;
}

interface RecordPaymentDemoInput {
  assetId: string;
  operatorWallet: string;
  amount: number;
  evidenceHash: string;
}

interface ClaimDemoInput {
  assetId: string;
  investorWallet: string;
}

interface TransferDemoInput {
  assetId: string;
  investorWallet: string;
  recipientWallet: string;
  amount: number;
}

interface DemoDataState {
  assets: Asset[];
  documents: AssetDocument[];
  activity: ActivityEvent[];
  portfolio: PortfolioItem[];
  reviews: ReviewAction[];
  whitelist: WhitelistEntry[];
  payments: PaymentRecord[];
}

interface DemoStore extends DemoDataState {
  resetDemoData: () => void;
  createAssetDemo: (input: CreateDemoAssetInput) => Asset;
  addDocumentDemo: (assetId: string, file: File, kind: AssetDocument['kind'], contentHash: string) => AssetDocument;
  investDemo: (input: InvestDemoInput) => Asset;
  verifyAssetDemo: (input: VerifyDemoInput) => ReviewAction;
  openFundingDemo: (assetId: string) => Asset;
  closeFundingDemo: (assetId: string) => Asset;
  recordPaymentDemo: (input: RecordPaymentDemoInput) => PaymentRecord;
  finalizeAssetDemo: (assetId: string) => Asset;
  claimPayoutDemo: (input: ClaimDemoInput) => void;
  refundDemo: (input: ClaimDemoInput) => void;
  transferDemo: (input: TransferDemoInput) => void;
  upsertWhitelistDemo: (wallet: string, roleMask: number, kycRefHash?: string) => WhitelistEntry;
}

function cloneSeed<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso() {
  return new Date().toISOString();
}

function createInitialState(): DemoDataState {
  return {
    assets: cloneSeed(MOCK_ASSETS),
    documents: cloneSeed(MOCK_DOCUMENTS),
    activity: cloneSeed(MOCK_ACTIVITY),
    portfolio: cloneSeed(MOCK_PORTFOLIO).map((item) => ({ ...item, claimed: false })),
    reviews: [],
    whitelist: [],
    payments: [],
  };
}

function addActivity(
  activity: ActivityEvent[],
  assetId: string,
  action: string,
  actorWallet: string,
  payload?: Record<string, unknown>
) {
  return [
    ...activity,
    {
      id: crypto.randomUUID(),
      assetId,
      action,
      actorWallet,
      payload,
      createdAt: nowIso(),
    },
  ];
}

function syncPortfolioAssets(assets: Asset[], portfolio: PortfolioItem[]) {
  return portfolio.map((item) => {
    const asset = assets.find((candidate) => candidate.id === item.asset.id) ?? item.asset;
    return { ...item, asset };
  });
}

function updateAsset(assets: Asset[], assetId: string, updates: Partial<Asset>) {
  return assets.map((asset) =>
    asset.id === assetId ? { ...asset, ...updates, updatedAt: nowIso() } : asset
  );
}

function assetFundingStatus(asset: Asset): AssetStatus {
  if (asset.fundingRaised <= 0) return 'Cancelled';
  return 'Funded';
}

export const useDemoStore = create<DemoStore>()((set, get) => ({
  ...createInitialState(),

  resetDemoData: () => set(createInitialState()),

  createAssetDemo: (input) => {
    const asset: Asset = {
      id: crypto.randomUUID(),
      issuerWallet: input.issuerWallet,
      status: 'Created',
      faceValue: input.faceValue,
      discountBps: input.discountBps,
      fundingTarget: Math.round(input.faceValue * (1 - input.discountBps / 10000)),
      fundingRaised: 0,
      dueDateTs: input.dueDateTs,
      debtorRefHash: input.debtorRefHash,
      invoiceHash: input.invoiceHash,
      metadataUri: `demo://asset/${crypto.randomUUID()}`,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    set((state) => ({
      assets: [asset, ...state.assets],
      activity: addActivity(state.activity, asset.id, 'create_asset', input.issuerWallet, {
        faceValue: input.faceValue,
        discountBps: input.discountBps,
      }),
    }));

    return asset;
  },

  addDocumentDemo: (assetId, file, kind, contentHash) => {
    const document: AssetDocument = {
      id: crypto.randomUUID(),
      assetId,
      filename: file.name,
      fileUri: '#',
      contentHash,
      kind,
      uploadedAt: nowIso(),
    };

    set((state) => ({
      documents: [document, ...state.documents],
      assets: updateAsset(state.assets, assetId, kind === 'invoice' ? { invoiceHash: contentHash } : {}),
    }));

    return document;
  },

  investDemo: ({ assetId, investorWallet, amount }) => {
    const state = get();
    const asset = state.assets.find((candidate) => candidate.id === assetId);
    if (!asset) {
      throw new Error('Asset not found');
    }

    const discountFactor = 1 - asset.discountBps / 10000;
    const nominalTokens = Math.max(1, Math.round((amount / discountFactor) / 1_000_000));
    const payoutBaseUnits = nominalTokens * 1_000_000;
    const nextRaised = Math.min(asset.fundingTarget, asset.fundingRaised + amount);
    const nextStatus = nextRaised >= asset.fundingTarget ? 'Funded' : asset.status;
    const nextAssets = updateAsset(state.assets, assetId, {
      fundingRaised: nextRaised,
      status: nextStatus,
    });

    const nextPortfolio = syncPortfolioAssets(
      nextAssets,
      (() => {
        const existing = state.portfolio.find((item) => item.asset.id === assetId);
        if (!existing) {
          return [
            ...state.portfolio,
            {
              asset: nextAssets.find((candidate) => candidate.id === assetId) ?? asset,
              tokenBalance: nominalTokens,
              contributedUsdc: amount,
              expectedPayout: payoutBaseUnits,
              refunded: false,
              claimed: false,
            },
          ];
        }

        return state.portfolio.map((item) =>
          item.asset.id === assetId
            ? {
                ...item,
                asset: nextAssets.find((candidate) => candidate.id === assetId) ?? item.asset,
                tokenBalance: item.tokenBalance + nominalTokens,
                contributedUsdc: item.contributedUsdc + amount,
                expectedPayout: item.expectedPayout + payoutBaseUnits,
              }
            : item
        );
      })()
    );

    set({
      assets: nextAssets,
      portfolio: nextPortfolio,
      activity: addActivity(state.activity, assetId, 'buy_primary', investorWallet, {
        amount,
        tokenBalance: nominalTokens,
      }),
    });

    return nextAssets.find((candidate) => candidate.id === assetId) ?? asset;
  },

  verifyAssetDemo: ({ assetId, verifierWallet, decision, comment }) => {
    const review: ReviewAction = {
      id: crypto.randomUUID(),
      assetId,
      verifierWallet,
      decision,
      comment,
      createdAt: nowIso(),
    };

    set((state) => {
      const status = decision === 'approved' ? 'Verified' : 'Cancelled';
      const nextAssets = updateAsset(state.assets, assetId, { status });
      return {
        assets: nextAssets,
        portfolio: syncPortfolioAssets(nextAssets, state.portfolio),
        reviews: [review, ...state.reviews],
        activity: addActivity(state.activity, assetId, 'verify_asset', verifierWallet, {
          decision,
          comment,
        }),
      };
    });

    return review;
  },

  openFundingDemo: (assetId) => {
    const state = get();
    const nextAssets = updateAsset(state.assets, assetId, { status: 'FundingOpen' });
    const updatedAsset = nextAssets.find((asset) => asset.id === assetId);
    if (!updatedAsset) {
      throw new Error('Asset not found');
    }

    set({
      assets: nextAssets,
      portfolio: syncPortfolioAssets(nextAssets, state.portfolio),
      activity: addActivity(state.activity, assetId, 'open_funding', 'demo-admin'),
    });

    return updatedAsset;
  },

  closeFundingDemo: (assetId) => {
    const state = get();
    const asset = state.assets.find((candidate) => candidate.id === assetId);
    if (!asset) {
      throw new Error('Asset not found');
    }

    const nextAssets = updateAsset(state.assets, assetId, {
      status: assetFundingStatus(asset),
    });
    const updatedAsset = nextAssets.find((candidate) => candidate.id === assetId);
    if (!updatedAsset) {
      throw new Error('Asset not found');
    }

    set({
      assets: nextAssets,
      portfolio: syncPortfolioAssets(nextAssets, state.portfolio),
      activity: addActivity(state.activity, assetId, 'close_funding', 'demo-admin'),
    });

    return updatedAsset;
  },

  recordPaymentDemo: ({ assetId, operatorWallet, amount, evidenceHash }) => {
    const payment: PaymentRecord = {
      assetId,
      operatorWallet,
      amount,
      evidenceHash,
      createdAt: nowIso(),
    };

    set((state) => {
      const nextAssets = updateAsset(state.assets, assetId, { status: 'Paid' });
      return {
        assets: nextAssets,
        portfolio: syncPortfolioAssets(nextAssets, state.portfolio),
        payments: [payment, ...state.payments],
        documents: [
          {
            id: crypto.randomUUID(),
            assetId,
            filename: 'repayment-evidence.txt',
            fileUri: '#',
            contentHash: evidenceHash,
            kind: 'evidence',
            uploadedAt: nowIso(),
          },
          ...state.documents,
        ],
        activity: addActivity(state.activity, assetId, 'record_payment', operatorWallet, {
          amount,
          evidenceHash,
        }),
      };
    });

    return payment;
  },

  finalizeAssetDemo: (assetId) => {
    const state = get();
    const nextAssets = updateAsset(state.assets, assetId, { status: 'Closed' });
    const updatedAsset = nextAssets.find((asset) => asset.id === assetId);
    if (!updatedAsset) {
      throw new Error('Asset not found');
    }

    set({
      assets: nextAssets,
      portfolio: syncPortfolioAssets(nextAssets, state.portfolio),
      activity: addActivity(state.activity, assetId, 'finalize_asset', 'demo-admin'),
    });

    return updatedAsset;
  },

  claimPayoutDemo: ({ assetId, investorWallet }) => {
    set((state) => ({
      portfolio: syncPortfolioAssets(
        state.assets,
        state.portfolio.map((item) =>
          item.asset.id === assetId
            ? { ...item, claimed: true }
            : item
        )
      ),
      activity: addActivity(state.activity, assetId, 'claim_payout', investorWallet),
    }));
  },

  refundDemo: ({ assetId, investorWallet }) => {
    set((state) => ({
      portfolio: syncPortfolioAssets(
        state.assets,
        state.portfolio.map((item) =>
          item.asset.id === assetId
            ? { ...item, refunded: true }
            : item
        )
      ),
      activity: addActivity(state.activity, assetId, 'refund', investorWallet),
    }));
  },

  transferDemo: ({ assetId, investorWallet, recipientWallet, amount }) => {
    set((state) => {
      const asset = state.assets.find((candidate) => candidate.id === assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      const nextPortfolio = syncPortfolioAssets(
        state.assets,
        state.portfolio.map((item) => {
          if (item.asset.id !== assetId) return item;

          const nextTokenBalance = Math.max(0, item.tokenBalance - amount);
          const nextExpectedPayout = nextTokenBalance * 1_000_000;
          const nextContributed = Math.round(nextExpectedPayout * (1 - asset.discountBps / 10000));

          return {
            ...item,
            tokenBalance: nextTokenBalance,
            expectedPayout: nextExpectedPayout,
            contributedUsdc: nextContributed,
          };
        })
      );

      return {
        portfolio: nextPortfolio,
        activity: addActivity(state.activity, assetId, 'secondary_transfer', investorWallet, {
          recipientWallet,
          amount,
        }),
      };
    });
  },

  upsertWhitelistDemo: (wallet, roleMask, kycRefHash) => {
    const entry: WhitelistEntry = {
      wallet,
      roleMask,
      kycRefHash,
      active: true,
    };

    set((state) => ({
      whitelist: [
        entry,
        ...state.whitelist.filter((candidate) => candidate.wallet !== wallet),
      ],
    }));

    return entry;
  },
}));
