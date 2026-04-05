import "../src/load-env";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const USERS = [
  {
    id: "seed-user-issuer",
    wallet: "issuer_demo_wallet",
    role: "Issuer",
    displayName: "Issuer Demo",
  },
  {
    id: "seed-user-investor-a",
    wallet: "investor_a_demo_wallet",
    role: "Investor",
    displayName: "Investor A Demo",
  },
  {
    id: "seed-user-investor-b",
    wallet: "investor_b_demo_wallet",
    role: "Investor",
    displayName: "Investor B Demo",
  },
  {
    id: "seed-user-verifier",
    wallet: "verifier_demo_wallet",
    role: "Verifier",
    displayName: "Verifier Demo",
  },
  {
    id: "seed-user-admin",
    wallet: "admin_demo_wallet",
    role: "Admin",
    displayName: "Admin Demo",
  },
  {
    id: "seed-user-attestor",
    wallet: "attestor_demo_wallet",
    role: "Attestor",
    displayName: "Attestor Demo",
  },
];

async function main(): Promise<void> {
  for (const user of USERS) {
    await prisma.user.upsert({
      where: { wallet: user.wallet },
      create: {
        id: user.id,
        wallet: user.wallet,
        role: user.role,
        displayName: user.displayName,
        active: true,
      },
      update: {
        role: user.role,
        displayName: user.displayName,
        active: true,
      },
    });
  }

  console.log("Seed completed: users/roles upserted.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
