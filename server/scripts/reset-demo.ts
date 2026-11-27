// Wipes the database and loads the demo data again.
// Usage: npm run reset-demo -- --yes
import mongoose from "mongoose";
import { config } from "../src/config";
import { resetDemo } from "../src/bootstrap";

async function main() {
  if (!config.mongoUri) {
    console.log("MONGO_URI is not set, so there is no stored database to reset. The in-memory database starts fresh every time.");
    return;
  }
  const host = new URL(config.mongoUri.replace(/^mongodb(\+srv)?:/, "http:")).host;
  if (!process.argv.includes("--yes")) {
    console.error(`This deletes ALL data in the database on ${host} and loads the demo data.\nRun again with --yes to continue:  npm run reset-demo -- --yes`);
    process.exit(1);
  }
  const password = config.demoPassword ?? process.env.DEMO_PASSWORD;
  if (!password || password.length < 8) {
    console.error("DEMO_PASSWORD (at least 8 characters) is needed to create the demo users.");
    process.exit(1);
  }
  await mongoose.connect(config.mongoUri);
  const { cleared } = await resetDemo(password);
  console.log(`Cleared ${cleared} collections on ${host} and loaded the demo data.`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
