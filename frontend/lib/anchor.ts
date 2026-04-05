'use client';

import { useWallet } from '@solana/wallet-adapter-react';

/**
 * Returns helper functions to call on-chain instructions.
 * Until backend provides the IDL, these are stubs that will be
 * replaced with actual Anchor calls once the program is deployed.
 */
export function useAnchorProgram() {
  const { publicKey } = useWallet();

  const ensureWallet = () => {
    if (!publicKey) throw new Error('Wallet not connected');
    return publicKey;
  };

  /**
   * buy_primary — investor buys tokens for a given USDC amount.
   * TODO: replace with actual Anchor instruction once IDL is shared.
   */
  const buyPrimary = async (_assetPda: string, _usdcAmount: number): Promise<string> => {
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
  };

  /**
   * claimPayout — investor burns tokens and receives USDC.
   */
  const claimPayout = async (_assetPda: string): Promise<string> => {
    ensureWallet();
    // TODO: replace with actual Anchor instruction
    throw new Error('STUB: implement claim_payout with Anchor IDL');
  };

  /**
   * secondaryTransfer — transfers tokens to an allowlisted recipient.
   * Transfer Hook will enforce on-chain restriction.
   */
  const secondaryTransfer = async (
    _mintPubkey: string,
    _recipient: string,
    _amount: number
  ): Promise<string> => {
    ensureWallet();
    // TODO: Use @solana/spl-token's transfer with hook
    throw new Error('STUB: implement secondary_transfer with Token-2022 transfer hook');
  };

  return { buyPrimary, claimPayout, secondaryTransfer };
}
