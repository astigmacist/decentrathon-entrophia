import * as Joi from "joi";

const PLACEHOLDER_BASE58 = "11111111111111111111111111111111";

function requiredRealBase58(label: string) {
  return Joi.string()
    .pattern(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)
    .invalid(PLACEHOLDER_BASE58)
    .required()
    .messages({
      "any.invalid": `${label} must be replaced with a real deployed address, placeholder 111... is not allowed`,
    });
}

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "test", "production")
    .default("development"),
  PORT: Joi.number().port().default(3001),
  DATABASE_URL: Joi.string().uri().required(),
  LOG_LEVEL: Joi.string()
    .valid("debug", "info", "warn", "error")
    .default("info"),
  REDIS_URL: Joi.string().uri().optional(),
  STORAGE_PROVIDER: Joi.string().valid("memory", "minio", "s3", "pinata").default("minio"),
  MINIO_ENDPOINT: Joi.string().optional(),
  MINIO_PORT: Joi.number().port().optional(),
  MINIO_USE_SSL: Joi.boolean().default(false),
  MINIO_ACCESS_KEY: Joi.string().optional(),
  MINIO_SECRET_KEY: Joi.string().optional(),
  MINIO_BUCKET: Joi.string().optional(),
  PINATA_JWT: Joi.string().allow("").optional(),
  SOLANA_CLUSTER: Joi.string().valid("devnet").default("devnet"),
  SOLANA_RPC_URL: Joi.string().uri().required(),
  SOLANA_TX_MODE: Joi.string().valid("sync", "client").default("sync"),
  SOLANA_TX_MAX_AGE_SECONDS: Joi.number().integer().greater(0).default(900),
  USDC_MINT: requiredRealBase58("USDC_MINT"),
  RECEIVABLES_PROGRAM_ID: requiredRealBase58("RECEIVABLES_PROGRAM_ID"),
  TRANSFER_HOOK_PROGRAM_ID: requiredRealBase58("TRANSFER_HOOK_PROGRAM_ID"),
  ADMIN_WALLET: requiredRealBase58("ADMIN_WALLET"),
  VERIFIER_WALLET: requiredRealBase58("VERIFIER_WALLET"),
  ATTESTOR_WALLET: requiredRealBase58("ATTESTOR_WALLET"),
  ISSUER_WALLET: requiredRealBase58("ISSUER_WALLET"),
  INVESTOR_A_WALLET: requiredRealBase58("INVESTOR_A_WALLET"),
  INVESTOR_B_WALLET: requiredRealBase58("INVESTOR_B_WALLET"),
  ASSET_TOKEN_DECIMALS: Joi.number().integer().valid(6).default(6),
  FUNDING_TARGET_BPS: Joi.number().integer().min(1).max(10000).default(9500),
  FUNDING_WINDOW_HOURS: Joi.number().integer().greater(0).default(48),
  DISCOUNT_BPS: Joi.number().integer().min(1).max(10000).default(9500),
});
