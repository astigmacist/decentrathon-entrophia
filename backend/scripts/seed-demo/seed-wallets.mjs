import { env, runSql, sql } from "./_shared.mjs";

const rows = [
  ["demo-admin", env.adminWallet, "Admin", "Demo Admin"],
  ["demo-verifier", env.verifierWallet, "Verifier", "Demo Verifier"],
  ["demo-attestor", env.attestorWallet, "Attestor", "Demo Attestor"],
  ["demo-issuer", env.issuerWallet, "Issuer", "Demo Issuer"],
  ["demo-investor-a", env.investorAWallet, "Investor", "Demo Investor A"],
  ["demo-investor-b", env.investorBWallet, "Investor", "Demo Investor B"],
];

const values = rows
  .map(
    ([id, wallet, role, name]) =>
      `(${sql(id)}, ${sql(wallet)}, ${sql(role)}, ${sql(name)}, true, NOW(), NOW())`,
  )
  .join(",\n");

runSql(`
INSERT INTO users (id, wallet, role, display_name, active, created_at, updated_at)
VALUES
${values}
ON CONFLICT (wallet) DO UPDATE
SET
  role = EXCLUDED.role,
  display_name = EXCLUDED.display_name,
  active = EXCLUDED.active,
  updated_at = NOW();
`);

console.log("seed-wallets completed.");
