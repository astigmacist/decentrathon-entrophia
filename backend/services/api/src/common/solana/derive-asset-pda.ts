import { PublicKey } from "@solana/web3.js";

const SEED_ASSET = Buffer.from("asset", "utf8");

export function deriveAssetPda(programIdBase58: string, assetId: string): string {
  const programId = new PublicKey(programIdBase58);
  const [pda] = PublicKey.findProgramAddressSync(
    [SEED_ASSET, Buffer.from(assetId, "utf8")],
    programId,
  );
  return pda.toBase58();
}
