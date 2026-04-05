import { IndexerService } from "./worker";

const pollIntervalMs = Number(process.env.INDEXER_POLL_INTERVAL_MS || "4000");

async function bootstrap(): Promise<void> {
  const worker = new IndexerService();
  await worker.start();
  setInterval(async () => {
    try {
      await worker.poll();
    } catch (error) {
      // Keep process alive and continue retries.
      console.error("[indexer] poll error", error);
    }
  }, pollIntervalMs);
}

bootstrap().catch((error) => {
  console.error("[indexer] fatal bootstrap error", error);
  process.exit(1);
});
