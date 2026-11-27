import { existsSync } from "node:fs";

export class ConfigError extends Error {}

export interface Config {
  env: string;
  isProduction: boolean;
  port: number;
  mongoUri: string;
  jwtSecret: string;
  accessTtl: string;
  refreshTtlMs: number;
  bankWebhookSecret: string;
  clientOrigins: string[];
  trustProxy: number;
  seedOnEmpty: boolean;
  demoPassword: string | undefined;
}

// development values, used only outside production
const DEV_JWT_SECRET = "dev-secret-change-me";
const DEV_WEBHOOK_SECRET = "dev-bank-secret";
const DEV_DEMO_PASSWORD = "Demo@1234";

const flag = (v: string | undefined, fallback: boolean) => (v === undefined || v === "" ? fallback : !/^(0|false|no|off)$/i.test(v.trim()));

// Reads the environment. In production every secret must be set and strong; the error lists everything that is wrong at once.
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const isProduction = env.NODE_ENV === "production";
  const problems: string[] = [];
  const need = (name: string, why: string) => problems.push(`${name}: ${why}`);

  const port = env.PORT ? Number(env.PORT) : 5000;
  if (!Number.isInteger(port) || port < 1 || port > 65535) need("PORT", "must be a number between 1 and 65535");

  const mongoUri = env.MONGO_URI ?? "";
  if (isProduction && !/^mongodb(\+srv)?:\/\//.test(mongoUri)) need("MONGO_URI", "required in production, a mongodb:// or mongodb+srv:// connection string");

  let jwtSecret = env.JWT_SECRET ?? "";
  if (isProduction) {
    if (!jwtSecret) need("JWT_SECRET", "required in production (at least 32 characters, for example `openssl rand -hex 32`)");
    else if (jwtSecret.length < 32 || jwtSecret === DEV_JWT_SECRET) need("JWT_SECRET", "too weak: use at least 32 random characters");
  } else jwtSecret ||= DEV_JWT_SECRET;

  let bankWebhookSecret = env.BANK_WEBHOOK_SECRET ?? "";
  if (isProduction) {
    if (!bankWebhookSecret) need("BANK_WEBHOOK_SECRET", "required in production (at least 16 characters)");
    else if (bankWebhookSecret.length < 16 || bankWebhookSecret === DEV_WEBHOOK_SECRET) need("BANK_WEBHOOK_SECRET", "too weak: use at least 16 random characters");
  } else bankWebhookSecret ||= DEV_WEBHOOK_SECRET;

  // CORS allows exactly these origins, nothing else
  const rawOrigins = (env.CLIENT_URL ?? (isProduction ? "" : "http://localhost:5173")).split(",").map((s) => s.trim()).filter(Boolean);
  const clientOrigins: string[] = [];
  if (rawOrigins.length === 0) need("CLIENT_URL", "required in production, the address of the web app (several can be separated by commas)");
  for (const raw of rawOrigins) {
    try {
      const u = new URL(raw);
      const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
      if (!/^https?:$/.test(u.protocol) || raw.includes("*")) throw new Error("bad");
      if (isProduction && u.protocol !== "https:" && !local) need("CLIENT_URL", `${raw} must use https in production`);
      else clientOrigins.push(u.origin);
    } catch {
      need("CLIENT_URL", `"${raw}" is not an origin like https://app.example.com (no wildcards)`);
    }
  }

  // the public default password is only ever used on a local, throwaway database
  const hosted = isProduction || mongoUri.startsWith("mongodb+srv");
  const seedOnEmpty = flag(env.SEED_ON_EMPTY, true);
  const demoPassword = env.DEMO_PASSWORD || (hosted ? undefined : DEV_DEMO_PASSWORD);
  if (hosted && seedOnEmpty && (!demoPassword || demoPassword.length < 8)) {
    need("DEMO_PASSWORD", "needed to create the demo users on a hosted database (at least 8 characters). Set SEED_ON_EMPTY=false to start with an empty database");
  }

  const proxy = env.TRUST_PROXY === undefined || env.TRUST_PROXY === "" ? (isProduction ? 1 : 0) : Number(env.TRUST_PROXY);
  if (!Number.isInteger(proxy) || proxy < 0) need("TRUST_PROXY", "must be a whole number of proxies in front of the API (0 for none)");

  if (problems.length) {
    throw new ConfigError(`The API cannot start. Fix these environment variables:\n${problems.map((p) => `  - ${p}`).join("\n")}\nSee server/.env.example.`);
  }

  return {
    env: env.NODE_ENV ?? "development",
    isProduction,
    port,
    mongoUri,
    jwtSecret,
    accessTtl: "15m",
    refreshTtlMs: 7 * 24 * 3600 * 1000,
    bankWebhookSecret,
    clientOrigins,
    trustProxy: proxy,
    seedOnEmpty,
    demoPassword,
  };
}

// a local .env file fills in what the host did not set; real environment variables always win
if (process.env.NODE_ENV !== "test" && existsSync(".env")) process.loadEnvFile(".env");

export const config: Config = (() => {
  try {
    return loadConfig();
  } catch (e) {
    if (e instanceof ConfigError) {
      console.error(e.message);
      process.exit(1);
    }
    throw e;
  }
})();
