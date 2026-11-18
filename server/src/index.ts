import http from "http";
import mongoose from "mongoose";
import cron from "node-cron";
import { createApp } from "./app";
import { config } from "./config";
import { seedDemo } from "./seed";
import { markOverdue } from "./modules/repayments/overdue";
import { runAccruals, yesterday } from "./modules/ledger/accruals";

async function main() {
  let uri = config.mongoUri;
  if (!uri) {
    const { MongoMemoryReplSet } = await import("mongodb-memory-server");
    const repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    uri = repl.getUri();
    console.log("Using in-memory MongoDB (data is lost on restart)");
  }
  await mongoose.connect(uri);
  if (process.env.SEED === "1" || !config.mongoUri) await seedDemo(uri);

  cron.schedule("0 1 * * *", async () => {
    const n = await markOverdue();
    console.log(`overdue job: ${n} invoices`);
  });

  // accruals for the day that just finished; running the same date twice posts nothing the second time
  cron.schedule("10 1 * * *", async () => {
    try {
      const r = await runAccruals(yesterday(), undefined, "SCHEDULE");
      console.log(`accrual job ${r.date}: ${r.alreadyRun ? "already run" : `${r.count} payouts`}`);
    } catch (e) {
      console.error("accrual job failed", e);
    }
  });

  http.createServer(createApp()).listen(config.port, () => console.log(`API on ${config.port}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
