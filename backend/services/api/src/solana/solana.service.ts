import { randomUUID } from "crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";
import { SolanaOrchestrationInput, SolanaOrchestrationMode, SolanaOrchestrationResult } from "./solana.types";

@Injectable()
export class SolanaService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async orchestrate(input: SolanaOrchestrationInput): Promise<SolanaOrchestrationResult> {
    const mode = this.resolveMode(input.mode);
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

    const txSignature = input.txSig?.trim() || this.syntheticSignature();
    const confirmed = await this.verifyTxSignature(txSignature);
    await this.logActivity(input, txSignature, confirmed ? "confirmed" : "submitted");
    return {
      mode,
      txSignature,
      result: confirmed ? "confirmed" : "submitted",
      unsignedTx: null,
      nextAction: "none",
    };
  }

  private buildUnsignedTx(input: SolanaOrchestrationInput): string {
    const raw = JSON.stringify({
      action: input.action,
      wallet: input.wallet,
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

  private syntheticSignature(): string {
    return `sim-${randomUUID().replace(/-/g, "")}`;
  }

  private async verifyTxSignature(txSignature: string): Promise<boolean> {
    const rpcUrl = this.configService.get<string>("SOLANA_RPC_URL");
    if (!rpcUrl) {
      return false;
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
        return false;
      }
      const payload = (await response.json()) as {
        result?: { value?: Array<{ confirmationStatus?: string; err?: unknown } | null> };
      };
      const status = payload.result?.value?.[0];
      if (!status || status.err !== null && status.err !== undefined) {
        return false;
      }
      return status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized";
    } catch {
      return false;
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
