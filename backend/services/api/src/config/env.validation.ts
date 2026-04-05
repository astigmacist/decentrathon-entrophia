import * as Joi from "joi";

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
  USDC_MINT: Joi.string().pattern(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/).required(),
  RECEIVABLES_PROGRAM_ID: Joi.string()
    .pattern(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)
    .required(),
  TRANSFER_HOOK_PROGRAM_ID: Joi.string()
    .pattern(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)
    .required(),
  ADMIN_WALLET: Joi.string().pattern(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/).required(),
  VERIFIER_WALLET: Joi.string().pattern(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/).required(),
  ATTESTOR_WALLET: Joi.string().pattern(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/).required(),
  ISSUER_WALLET: Joi.string().pattern(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/).required(),
  INVESTOR_A_WALLET: Joi.string().pattern(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/).required(),
  INVESTOR_B_WALLET: Joi.string().pattern(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/).required(),
  ASSET_TOKEN_DECIMALS: Joi.number().integer().valid(6).default(6),
  FUNDING_TARGET_BPS: Joi.number().integer().min(1).max(10000).default(9500),
  FUNDING_WINDOW_HOURS: Joi.number().integer().greater(0).default(48),
  DISCOUNT_BPS: Joi.number().integer().min(1).max(10000).default(9500),
});
