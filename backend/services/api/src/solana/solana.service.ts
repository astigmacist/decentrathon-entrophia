import { randomUUID } from "crypto";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppException } from "../common/exceptions/app.exception";
import { PrismaService } from "../database/prisma.service";
import { SolanaOrchestrationInput, SolanaOrchestrationMode, SolanaOrchestrationResult } from "./solana.types";

const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

@Injectable()
export class SolanaService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async orchestrate(input: SolanaOrchestrationInput): Promise<SolanaOrchestrationResult> {
    const mode = this.resolveMode(input.mode);
    const expectedMemo = this.buildExpectedMemo(input);
    const unsignedTx = this.buildUnsignedTx(input);

    if (mode === "client") {
      await this.logActivity(input, null, "prepared");
      return {
        mode,
        txSignature: null,
        result: "prepared",
        unsignedTx,
        nextAction: "sign",
      };
    }

    const txSignature = input.txSig?.trim();
    if (!txSignature) {
      throw new AppException(
        "SOLANA_TX_SIGNATURE_REQUIRED",
        "Sync orchestration requires a confirmed tx signature. Submit the transaction client-side first.",
        HttpStatus.CONFLICT,
      );
    }

    await this.assertTxSignatureUnused(txSignature);

    const verification = await this.verifyTxSignature(txSignature, input.wallet, expectedMemo);
    if (!verification.ok) {
      throw new AppException(
        verification.code,
        verification.message,
        HttpStatus.CONFLICT,
      );
    }

    await this.logActivity(input, txSignature, "confirmed");
    return {
      mode,
      txSignature,
      result: "confirmed",
      unsignedTx: null,
      nextAction: "none",
    };
  }

  private buildUnsignedTx(input: SolanaOrchestrationInput): string {
    const raw = JSON.stringify({
      action: input.action,
      wallet: input.wallet,
      memo: this.buildExpectedMemo(input),
      payload: input.payload ?? {},
      ts: Date.now(),
    });
    return Buffer.from(raw, "utf8").toString("base64");
  }

  private resolveMode(mode: SolanaOrchestrationMode | undefined): SolanaOrchestrationMode {
    if (mode === "client" || mode === "sync") {
      return mode;
    }
    const envMode = this.configService.get<string>("SOLANA_TX_MODE");
    return envMode === "client" ? "client" : "sync";
  }

  private async verifyTxSignature(
    txSignature: string,
    expectedWallet: string,
    expectedMemo: string,
  ): Promise<
    | { ok: true }
    | {
      ok: false;
      code:
        | "SOLANA_TX_NOT_CONFIRMED"
        | "SOLANA_TX_TOO_OLD"
        | "SOLANA_TX_MEMO_MISMATCH";
      message: string;
    }
  > {
    const rpcUrl = this.configService.get<string>("SOLANA_RPC_URL");
    if (!rpcUrl) {
      return {
        ok: false,
        code: "SOLANA_TX_NOT_CONFIRMED",
        message: "Transaction signature could not be verified because SOLANA_RPC_URL is missing.",
      };
    }

    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getSignatureStatuses",
          params: [[txSignature], { searchTransactionHistory: true }],
        }),
      });
      if (!response.ok) {
        return {
          ok: false,
          code: "SOLANA_TX_NOT_CONFIRMED",
          message: "Transaction signature is not confirmed for the provided x-wallet on Solana RPC yet.",
        };
      }
      const payload = (await response.json()) as {
        result?: { value?: Array<{ confirmationStatus?: string; err?: unknown } | null> };
      };
      const status = payload.result?.value?.[0];
      if (!status || status.err !== null && status.err !== undefined) {
        return {
          ok: false,
          code: "SOLANA_TX_NOT_CONFIRMED",
          message: "Transaction signature is not confirmed for the provided x-wallet on Solana RPC yet.",
        };
      }
      const isConfirmed =
        status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized";
      if (!isConfirmed) {
        return {
          ok: false,
          code: "SOLANA_TX_NOT_CONFIRMED",
          message: "Transaction signature is not confirmed for the provided x-wallet on Solana RPC yet.",
        };
      }

      const txResponse = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTransaction",
          params: [
            txSignature,
            {
              encoding: "jsonParsed",
              maxSupportedTransactionVersion: 0,
            },
          ],
        }),
      });
      if (!txResponse.ok) {
        return {
          ok: false,
          code: "SOLANA_TX_NOT_CONFIRMED",
          message: "Transaction signature is not confirmed for the provided x-wallet on Solana RPC yet.",
        };
      }

      const txPayload = (await txResponse.json()) as {
        result?: {
          blockTime?: number | null;
          transaction?: {
            message?: {
              accountKeys?: Array<string | { pubkey?: string; signer?: boolean }>;
              instructions?: Array<{
                programId?: string;
                program?: string;
                parsed?: string | { memo?: string };
              }>;
            };
          };
        } | null;
      };
      const txResult = txPayload.result;
      if (!txResult) {
        return {
          ok: false,
          code: "SOLANA_TX_NOT_CONFIRMED",
          message: "Transaction signature is not confirmed for the provided x-wallet on Solana RPC yet.",
        };
      }

      if (!this.isTxFresh(txResult.blockTime ?? null)) {
        return {
          ok: false,
          code: "SOLANA_TX_TOO_OLD",
          message: "Transaction signature is too old. Submit a fresh transaction for this action.",
        };
      }

      const accountKeys = txPayload.result?.transaction?.message?.accountKeys ?? [];
      const signerMatched = accountKeys.some((entry) => {
        if (typeof entry === "string") {
          return entry === expectedWallet;
        }
        return entry.pubkey === expectedWallet && entry.signer === true;
      });
      if (!signerMatched) {
        return {
          ok: false,
          code: "SOLANA_TX_NOT_CONFIRMED",
          message: "Transaction signature is not confirmed for the provided x-wallet on Solana RPC yet.",
        };
      }

      const instructions = txPayload.result?.transaction?.message?.instructions ?? [];
      const memo = this.extractMemo(instructions);
      if (memo !== expectedMemo) {
        return {
          ok: false,
          code: "SOLANA_TX_MEMO_MISMATCH",
          message: `Transaction memo must match ${expectedMemo}.`,
        };
      }

      return { ok: true };
    } catch {
      return {
        ok: false,
        code: "SOLANA_TX_NOT_CONFIRMED",
        message: "Transaction signature is not confirmed for the provided x-wallet on Solana RPC yet.",
      };
    }
  }

  private buildExpectedMemo(input: SolanaOrchestrationInput): string {
    return `rwa:${input.action}:${input.entityType ?? "asset"}:${input.entityId ?? "unknown"}:${input.wallet}`;
  }

  private isTxFresh(blockTime: number | null): boolean {
    if (!blockTime) {
      return false;
    }

    const maxAgeSeconds = this.configService.get<number>("SOLANA_TX_MAX_AGE_SECONDS") ?? 900;
    const nowSeconds = Math.floor(Date.now() / 1000);
    return nowSeconds - blockTime <= maxAgeSeconds;
  }

  private extractMemo(
    instructions: Array<{
      programId?: string;
      program?: string;
      parsed?: string | { memo?: string };
    }>,
  ): string | null {
    for (const instruction of instructions) {
      const isMemoProgram =
        instruction.programId === MEMO_PROGRAM_ID
        || instruction.program === "spl-memo"
        || instruction.program === "memo";
      if (!isMemoProgram) {
        continue;
      }

      if (typeof instruction.parsed === "string" && instruction.parsed.trim()) {
        return instruction.parsed.trim();
      }

      if (
        instruction.parsed
        && typeof instruction.parsed === "object"
        && typeof instruction.parsed.memo === "string"
        && instruction.parsed.memo.trim()
      ) {
        return instruction.parsed.memo.trim();
      }
    }

    return null;
  }

  private async assertTxSignatureUnused(txSignature: string): Promise<void> {
    const existing = await this.prisma.activityLog.findFirst({
      where: { txSig: txSignature },
      select: { id: true },
    });
    if (existing) {
      throw new AppException(
        "SOLANA_TX_REUSED",
        "Transaction signature has already been consumed by a prior backend action.",
        HttpStatus.CONFLICT,
      );
    }
  }

  private async logActivity(
    input: SolanaOrchestrationInput,
    txSig: string | null,
    result: "prepared" | "submitted" | "confirmed",
  ): Promise<void> {
    await this.prisma.activityLog.create({
      data: {
        id: randomUUID(),
        entityType: input.entityType ?? "asset",
        entityId: input.entityId ?? "unknown",
        action: input.action,
        wallet: input.wallet,
        result,
        txSig,
        payload: {
          mode: input.mode ?? "sync",
          ...(input.payload ?? {}),
        },
      },
    });
  }
}
