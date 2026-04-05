import { env, roleMask, runSql, sql } from "./_shared.mjs";

const entries = [
  ["wl-admin", env.adminWallet, roleMask(["Admin", "Verifier", "Attestor"]), "kyc-admin"],
  ["wl-verifier", env.verifierWallet, roleMask(["Verifier"]), "kyc-verifier"],
  ["wl-attestor", env.attestorWallet, roleMask(["Attestor"]), "kyc-attestor"],
  ["wl-issuer", env.issuerWallet, roleMask(["Issuer"]), "kyc-issuer"],
  ["wl-investor-a", env.investorAWallet, roleMask(["Investor"]), "kyc-investor-a"],
  ["wl-investor-b", env.investorBWallet, roleMask(["Investor"]), "kyc-investor-b"],
];

const values = entries
  .map(
    ([id, wallet, mask, kyc]) =>
      `(${sql(id)}, ${sql(wallet)}, ${sql(mask)}, ${sql(kyc)}, true, NOW(), NOW())`,
  )
  .join(",\n");

runSql(`
INSERT INTO whitelist_entries (id, wallet, role_mask, kyc_ref_hash, active, created_at, updated_at)
VALUES
${values}
ON CONFLICT (wallet) DO UPDATE
SET
  role_mask = EXCLUDED.role_mask,
  kyc_ref_hash = EXCLUDED.kyc_ref_hash,
  active = EXCLUDED.active,
  updated_at = NOW();
`);

console.log("seed-allowlist completed.");
