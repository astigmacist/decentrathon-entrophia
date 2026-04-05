import { createHash, randomUUID } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execSync } from "node:child_process";
import dotenv from "dotenv";

export const ROOT_DIR = "c:/deceathron-back";

if (existsSync(resolve(ROOT_DIR, ".env"))) {
  dotenv.config({ path: resolve(ROOT_DIR, ".env"), override: false });
}
if (existsSync(resolve(ROOT_DIR, "services/api/.env"))) {
  dotenv.config({ path: resolve(ROOT_DIR, "services/api/.env"), override: false });
}

export const env = {
  adminWallet: requireEnv("ADMIN_WALLET"),
  verifierWallet: requireEnv("VERIFIER_WALLET"),
  attestorWallet: requireEnv("ATTESTOR_WALLET"),
  issuerWallet: requireEnv("ISSUER_WALLET"),
  investorAWallet: requireEnv("INVESTOR_A_WALLET"),
  investorBWallet: requireEnv("INVESTOR_B_WALLET"),
  apiBaseUrl: process.env.DEMO_API_BASE_URL?.trim() || "http://127.0.0.1:3000/api",
  postgresContainer: process.env.DEMO_POSTGRES_CONTAINER?.trim() || "rwa-postgres",
  postgresDbUser: process.env.DEMO_POSTGRES_USER?.trim() || "rwa",
  postgresDbName: process.env.DEMO_POSTGRES_DB?.trim() || "rwa",
};

export function demoAssetId() {
  return process.env.DEMO_ASSET_ID?.trim() || "demo-asset-day6";
}

export function run(command) {
  execSync(command, { stdio: "inherit" });
}

export function runSql(sql) {
  const filename = `demo-seed-${Date.now()}-${randomUUID()}.sql`;
  const tempPath = join(tmpdir(), filename);
  writeFileSync(tempPath, sql, "utf8");
  const normalized = tempPath.replace(/\\/g, "/");
  run(`docker cp "${normalized}" ${env.postgresContainer}:/tmp/${filename}`);
  run(
    `docker exec ${env.postgresContainer} psql -v ON_ERROR_STOP=1 -U ${env.postgresDbUser} -d ${env.postgresDbName} -f /tmp/${filename}`,
  );
}

export function sql(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

export async function apiRequest(method, endpoint, options = {}) {
  const headers = {
    "content-type": "application/json",
    ...(options.wallet ? { "x-wallet": options.wallet } : {}),
  };
  const response = await fetch(`${env.apiBaseUrl}${endpoint}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  return { status: response.status, ok: response.ok, payload };
}

export function assertOk(result, label) {
  if (result.ok) {
    return;
  }
  throw new Error(`${label} failed (${result.status}): ${JSON.stringify(result.payload)}`);
}

export function roleMask(roleList) {
  return roleList.join("|");
}

export function sha256Hex(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function requireEnv(key) {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${key}`);
  }
  return value;
}
