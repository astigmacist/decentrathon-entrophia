import { config } from "dotenv";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { deriveAssetPda } from "../src/common/solana/derive-asset-pda";

config({ path: join(process.cwd(), ".env"), override: true });

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const programId = process.env.RECEIVABLES_PROGRAM_ID;
  if (!programId) {
    throw new Error("RECEIVABLES_PROGRAM_ID is required");
  }

  const rows = await prisma.asset.findMany({
    select: { id: true, assetId: true, assetPda: true },
  });

  let updated = 0;
  for (const row of rows) {
    const pda = deriveAssetPda(programId, row.assetId);
    if (row.assetPda === pda) {
      continue;
    }
    await prisma.asset.update({
      where: { id: row.id },
      data: { assetPda: pda },
    });
    updated += 1;
  }

  console.log(`Backfill asset PDA: ${updated} updated of ${rows.length} assets.`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
