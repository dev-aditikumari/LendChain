import http from "http";
import mongoose from "mongoose";
import cron from "node-cron";
import { createApp } from "./app";
import { config } from "./config";
import { seedDemo } from "./seed";
import { markOverdue } from "./modules/repayments/overdue";

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

  http.createServer(createApp()).listen(config.port, () => console.log(`API on ${config.port}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
