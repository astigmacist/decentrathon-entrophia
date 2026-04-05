import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";

type EventName =
  | "AssetCreated"
  | "AssetVerified"
  | "FundingOpened"
  | "PrimaryBought"
  | "FundingClosed"
  | "PaymentRecorded"
  | "PayoutClaimed"
  | "AssetFinalized"
  | "Refunded";

type AssetStatusUpdate =
  | "Created"
  | "Verified"
  | "FundingOpen"
  | "Funded"
  | "Cancelled"
  | "Paid"
  | "Closed";

type ParsedEvent = {
  name: EventName;
  signature: string;
  slot: number;
  entityId: string;
  assetStatus?: AssetStatusUpdate;
};

export class IndexerService {
  private readonly prisma = new PrismaClient();
  private readonly rpcUrl = process.env.SOLANA_RPC_URL ?? "";
  private readonly receivablesProgramId = process.env.RECEIVABLES_PROGRAM_ID ?? "";
  private readonly transferHookProgramId = process.env.TRANSFER_HOOK_PROGRAM_ID ?? "";
  private readonly cursorKey = "devnet-main";

  async start(): Promise<void> {
    if (!this.rpcUrl || !this.receivablesProgramId || !this.transferHookProgramId) {
      throw new Error("Indexer env is incomplete. Require SOLANA_RPC_URL + program IDs.");
    }
    await this.prisma.indexerCursor.upsert({
      where: { key: this.cursorKey },
      update: {},
      create: { key: this.cursorKey, lastProcessedSlot: BigInt(0) },
    });
    await this.poll();
  }

  async poll(): Promise<void> {
    const cursor = await this.prisma.indexerCursor.findUnique({
      where: { key: this.cursorKey },
    });
    const lastProcessedSlot = Number(cursor?.lastProcessedSlot ?? 0n);
    const signatures = await this.loadSignaturesAfterSlot(lastProcessedSlot);
    if (signatures.length === 0) {
      return;
    }

    let maxSlot = lastProcessedSlot;
    for (const item of signatures) {
      maxSlot = Math.max(maxSlot, item.slot);
      const events = await this.loadEventsForSignature(item.signature, item.slot);
      for (const event of events) {
        await this.applyEvent(event);
      }
    }

    await this.prisma.indexerCursor.update({
      where: { key: this.cursorKey },
      data: { lastProcessedSlot: BigInt(maxSlot) },
    });
  }

  private async loadSignaturesAfterSlot(
    minSlotExclusive: number,
  ): Promise<Array<{ signature: string; slot: number }>> {
    const responses = await Promise.all([
      this.rpc("getSignaturesForAddress", [this.receivablesProgramId, { limit: 50 }]),
      this.rpc("getSignaturesForAddress", [this.transferHookProgramId, { limit: 50 }]),
    ]);
    const all = responses
      .flatMap((payload) => payload?.result ?? [])
      .filter((row: { slot?: number; signature?: string }) => row?.slot && row?.signature)
      .map((row: { slot: number; signature: string }) => ({ slot: row.slot, signature: row.signature }))
      .filter((row) => row.slot > minSlotExclusive)
      .sort((a, b) => a.slot - b.slot);

    const dedup = new Map<string, { signature: string; slot: number }>();
    for (const row of all) {
      dedup.set(row.signature, row);
    }
    return [...dedup.values()].sort((a, b) => a.slot - b.slot);
  }

  private extractAccountPubkeys(result: any): string[] {
    const tx = result?.transaction;
    if (!tx) {
      return [];
    }
    const message = tx.message;
    if (!message) {
      return [];
    }
    const keys: string[] = [];
    const pushKey = (k: unknown) => {
      if (typeof k === "string") {
        keys.push(k);
      } else if (k && typeof k === "object" && "pubkey" in k && typeof (k as { pubkey: string }).pubkey === "string") {
        keys.push((k as { pubkey: string }).pubkey);
      }
    };
    if (Array.isArray(message.accountKeys)) {
      for (const k of message.accountKeys) {
        pushKey(k);
      }
    }
    if (Array.isArray(message.staticAccountKeys)) {
      for (const k of message.staticAccountKeys) {
        pushKey(k);
      }
    }
    const loaded = result?.meta?.loadedAddresses;
    if (loaded && typeof loaded === "object") {
      for (const k of loaded.writable ?? []) {
        if (typeof k === "string") {
          keys.push(k);
        }
      }
      for (const k of loaded.readonly ?? []) {
        if (typeof k === "string") {
          keys.push(k);
        }
      }
    }
    return [...new Set(keys)];
  }

  private async resolveEntityId(pubkeys: string[]): Promise<string | null> {
    if (pubkeys.length === 0) {
      return null;
    }
    const row = await this.prisma.asset.findFirst({
      where: { assetPda: { in: pubkeys } },
      select: { assetId: true },
    });
    return row?.assetId ?? null;
  }

  private fundingClosedStatusFromLogs(logs: string[]): "Funded" | "Cancelled" {
    const text = logs.join("\n");
    if (
      text.includes("AssetStatus::Cancelled") ||
      text.includes("status: Cancelled") ||
      /\bCancelled\b/.test(text)
    ) {
      if (text.includes("FundingClosed") || text.includes("close_funding")) {
        return "Cancelled";
      }
    }
    if (text.includes("AssetStatus::Funded") && text.includes("FundingClosed")) {
      return "Funded";
    }
    return "Funded";
  }

  private buildStatusForEvent(name: EventName, logs: string[]): AssetStatusUpdate | undefined {
    const baseMap: Partial<Record<EventName, AssetStatusUpdate>> = {
      AssetCreated: "Created",
      AssetVerified: "Verified",
      FundingOpened: "FundingOpen",
      PaymentRecorded: "Paid",
      AssetFinalized: "Closed",
    };
    if (name === "FundingClosed") {
      return this.fundingClosedStatusFromLogs(logs) === "Cancelled" ? "Cancelled" : "Funded";
    }
    if (name === "Refunded" || name === "PrimaryBought" || name === "PayoutClaimed") {
      return undefined;
    }
    return baseMap[name];
  }

  private async loadEventsForSignature(signature: string, slot: number): Promise<ParsedEvent[]> {
    const payload = await this.rpc("getTransaction", [
      signature,
      { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
    ]);
    const result = payload?.result;
    const logs = result?.meta?.logMessages as string[] | undefined;
    if (!logs || logs.length === 0) {
      return [];
    }
    const knownEvents: EventName[] = [
      "AssetCreated",
      "AssetVerified",
      "FundingOpened",
      "PrimaryBought",
      "FundingClosed",
      "PaymentRecorded",
      "PayoutClaimed",
      "AssetFinalized",
      "Refunded",
    ];
    const pubkeys = this.extractAccountPubkeys(result);
    const resolvedEntityId = (await this.resolveEntityId(pubkeys)) ?? "unknown";

    const parsed: ParsedEvent[] = [];
    const seen = new Set<string>();
    for (const line of logs) {
      const found = knownEvents.find((event) => line.includes(event));
      if (!found) {
        continue;
      }
      const dedupKey = `${found}:${signature}`;
      if (seen.has(dedupKey)) {
        continue;
      }
      seen.add(dedupKey);
      const assetStatus = this.buildStatusForEvent(found, logs);
      parsed.push({
        name: found,
        signature,
        slot,
        entityId: resolvedEntityId,
        assetStatus,
      });
    }
    return parsed;
  }

  private async applyEvent(event: ParsedEvent): Promise<void> {
    const already = await this.prisma.activityLog.findFirst({
      where: {
        entityType: "asset",
        action: event.name,
        txSig: event.signature,
      },
      select: { id: true },
    });
    if (already) {
      return;
    }

    await this.prisma.activityLog.create({
      data: {
        id: randomUUID(),
        entityType: "asset",
        entityId: event.entityId,
        action: event.name,
        txSig: event.signature,
        slot: BigInt(event.slot),
        payload: { slot: event.slot },
      },
    });

    if (event.entityId === "unknown" || !event.assetStatus) {
      return;
    }

    await this.prisma.asset.updateMany({
      where: { assetId: event.entityId },
      data: { status: event.assetStatus },
    });
  }

  private async rpc(method: string, params: unknown[]): Promise<any> {
    const response = await fetch(this.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      }),
    });
    if (!response.ok) {
      throw new Error(`RPC ${method} failed: ${response.status}`);
    }
    return response.json();
  }
}
