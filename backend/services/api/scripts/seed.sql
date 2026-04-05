
INSERT INTO users (id, wallet, role, display_name, active, created_at, updated_at)
VALUES
  ('seed-user-issuer', 'issuer_demo_wallet', 'Issuer', 'Issuer Demo', true, NOW(), NOW()),
  ('seed-user-investor-a', 'investor_a_demo_wallet', 'Investor', 'Investor A Demo', true, NOW(), NOW()),
  ('seed-user-investor-b', 'investor_b_demo_wallet', 'Investor', 'Investor B Demo', true, NOW(), NOW()),
  ('seed-user-verifier', 'verifier_demo_wallet', 'Verifier', 'Verifier Demo', true, NOW(), NOW()),
  ('seed-user-admin', 'admin_demo_wallet', 'Admin', 'Admin Demo', true, NOW(), NOW()),
  ('seed-user-attestor', 'attestor_demo_wallet', 'Attestor', 'Attestor Demo', true, NOW(), NOW())
ON CONFLICT (wallet) DO UPDATE
SET
  role = EXCLUDED.role,
  display_name = EXCLUDED.display_name,
  active = EXCLUDED.active,
  updated_at = NOW();
