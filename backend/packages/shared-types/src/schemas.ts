import { z } from "zod";
import { ASSET_STATUSES, ROLES } from "./enums.js";

export const assetStatusSchema = z.enum(ASSET_STATUSES);
export const roleSchema = z.enum(ROLES);

export const assetSchema = z.object({
  assetId: z.string().min(1),
  issuerWallet: z.string().min(1),
  invoiceHash: z.string().min(1),
  metadataUri: z.string().min(1),
  debtorRefHash: z.string().min(1),
  faceValue: z.string().regex(/^\d+$/),
  discountBps: z.number().int().min(0).max(10000),
  fundingTarget: z.string().regex(/^\d+$/),
  dueDate: z.string().datetime(),
  status: assetStatusSchema,
  mint: z.string().min(1).nullable(),
});

export const whitelistEntrySchema = z.object({
  wallet: z.string().min(1),
  roleMask: z.array(roleSchema).min(1),
  active: z.boolean(),
  kycRefHash: z.string().min(1),
  updatedAt: z.string().datetime(),
});

export const paymentEvidenceSchema = z.object({
  assetId: z.string().min(1),
  evidenceHash: z.string().min(1),
  amount: z.string().regex(/^\d+$/),
  operatorWallet: z.string().min(1),
  createdAt: z.string().datetime(),
});

export type Asset = z.infer<typeof assetSchema>;
export type WhitelistEntry = z.infer<typeof whitelistEntrySchema>;
export type PaymentEvidence = z.infer<typeof paymentEvidenceSchema>;
