'use client';

import { useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { PROGRAM_ID, USDC_MINT } from './solana';
import { toast } from 'sonner';

/**
 * Returns helper functions to call on-chain instructions.
 * Until backend provides the IDL, these are stubs that will be
 * replaced with actual Anchor calls once the program is deployed.
 */
export function useAnchorProgram() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const ensureWallet = () => {
    if (!publicKey) throw new Error('Wallet not connected');
    return publicKey;
  };

  /**
   * buy_primary — investor buys tokens for a given USDC amount.
   * TODO: replace with actual Anchor instruction once IDL is shared.
   */
  const buyPrimary = useCallback(
    async (assetPda: string, usdcAmount: number): Promise<string> => {
      ensureWallet();
      // Placeholder: build & send a dummy transaction for demo
      // Real implementation:
      //   const program = getProgram(connection, wallet);
      //   const tx = await program.methods
      //     .buyPrimary(new BN(usdcAmount))
      //     .accounts({ assetPda, investor: publicKey, ... })
      //     .transaction();
      //   return sendTransaction(tx, connection);
      throw new Error('STUB: implement buy_primary with Anchor IDL');
    },
    [publicKey, connection, sendTransaction]
  );

  /**
   * claimPayout — investor burns tokens and receives USDC.
   */
  const claimPayout = useCallback(
    async (assetPda: string): Promise<string> => {
      ensureWallet();
      // TODO: replace with actual Anchor instruction
      throw new Error('STUB: implement claim_payout with Anchor IDL');
    },
    [publicKey, connection, sendTransaction]
  );

  /**
   * secondaryTransfer — transfers tokens to an allowlisted recipient.
   * Transfer Hook will enforce on-chain restriction.
   */
  const secondaryTransfer = useCallback(
    async (mintPubkey: string, recipient: string, amount: number): Promise<string> => {
      ensureWallet();
      // TODO: Use @solana/spl-token's transfer with hook
      throw new Error('STUB: implement secondary_transfer with Token-2022 transfer hook');
    },
    [publicKey, connection, sendTransaction]
  );

  return { buyPrimary, claimPayout, secondaryTransfer };
}
