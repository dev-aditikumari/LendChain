import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { createApp } from "../src/app";
import { loadConfig, ConfigError } from "../src/config";
import { ensureDemoData, resetDemo } from "../src/bootstrap";
import { Entity, Invoice, LedgerEntry, User } from "../src/models";
import { resetDb, seedWorld, startDb, stopDb } from "./helpers";

const prod = {
  NODE_ENV: "production",
  MONGO_URI: "mongodb+srv://user:pass@cluster0.example.mongodb.net/lendchain",
  JWT_SECRET: "a".repeat(40),
  BANK_WEBHOOK_SECRET: "b".repeat(24),
  CLIENT_URL: "https://app.example.com",
  DEMO_PASSWORD: "Demo-Pass-1",
};

const message = (env: Record<string, string>) => {
  try {
    loadConfig(env);
  } catch (e) {
    expect(e).toBeInstanceOf(ConfigError);
    return (e as Error).message;
  }
  throw new Error("expected loadConfig to fail");
};

describe("configuration", () => {
  it("lists everything that is missing in production, in one message", () => {
    const m = message({ NODE_ENV: "production" });
    for (const name of ["MONGO_URI", "JWT_SECRET", "BANK_WEBHOOK_SECRET", "CLIENT_URL", "DEMO_PASSWORD"]) expect(m).toContain(name);
    expect(m).toContain(".env.example");
  });

  it("refuses weak or default secrets in production", () => {
    expect(message({ ...prod, JWT_SECRET: "short" })).toMatch(/JWT_SECRET: too weak/);
    expect(message({ ...prod, JWT_SECRET: "dev-secret-change-me" })).toMatch(/JWT_SECRET: too weak/);
    expect(message({ ...prod, BANK_WEBHOOK_SECRET: "dev-bank-secret" })).toMatch(/BANK_WEBHOOK_SECRET: too weak/);
    expect(message({ ...prod, MONGO_URI: "localhost:27017" })).toMatch(/MONGO_URI/);
  });

  it("accepts a complete production setup and normalises the client origins", () => {
    const c = loadConfig({ ...prod, CLIENT_URL: "https://app.example.com/, https://www.example.com , http://localhost:5173", PORT: "8080" });
    expect(c.clientOrigins).toEqual(["https://app.example.com", "https://www.example.com", "http://localhost:5173"]);
    expect(c).toMatchObject({ isProduction: true, port: 8080, trustProxy: 1, seedOnEmpty: true, demoPassword: "Demo-Pass-1" });
  });

  it("allows only real origins for the web app", () => {
    expect(message({ ...prod, CLIENT_URL: "*" })).toMatch(/CLIENT_URL/);
    expect(message({ ...prod, CLIENT_URL: "https://*.example.com" })).toMatch(/CLIENT_URL/);
    expect(message({ ...prod, CLIENT_URL: "app.example.com" })).toMatch(/CLIENT_URL/);
    expect(message({ ...prod, CLIENT_URL: "http://app.example.com" })).toMatch(/must use https/);
  });

  it("checks the port", () => {
    expect(message({ ...prod, PORT: "abc" })).toMatch(/PORT/);
    expect(message({ ...prod, PORT: "70000" })).toMatch(/PORT/);
  });

  it("works with an empty environment outside production", () => {
    const c = loadConfig({});
    expect(c).toMatchObject({ isProduction: false, port: 5000, mongoUri: "", clientOrigins: ["http://localhost:5173"], seedOnEmpty: true, demoPassword: "Demo@1234", trustProxy: 0 });
  });

  it("never seeds the public demo password into a hosted database", () => {
    const hosted = { MONGO_URI: prod.MONGO_URI };
    expect(message(hosted)).toMatch(/DEMO_PASSWORD/);
    expect(loadConfig({ ...hosted, SEED_ON_EMPTY: "false" }).seedOnEmpty).toBe(false);
    expect(loadConfig({ ...hosted, DEMO_PASSWORD: "Another-Pass-9" }).demoPassword).toBe("Another-Pass-9");
    expect(loadConfig({ ...prod, SEED_ON_EMPTY: "false", DEMO_PASSWORD: "" }).demoPassword).toBeUndefined();
  });
});

describe("running API", () => {
  beforeAll(startDb);
  afterAll(stopDb);
  beforeEach(resetDb);

  it("lets only the configured origin call it from a browser", async () => {
    const app = createApp({ clientOrigins: ["https://app.example.com"] });
    const ok = await request(app).get("/health").set("Origin", "https://app.example.com");
    expect(ok.headers["access-control-allow-origin"]).toBe("https://app.example.com");
    const other = await request(app).get("/health").set("Origin", "https://evil.example.net");
    expect(other.status).toBe(200);
    expect(other.headers["access-control-allow-origin"]).toBeUndefined();

    const pre = await request(app).options("/disbursements/x/authorise")
      .set("Origin", "https://app.example.com").set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "authorization,content-type,idempotency-key");
    expect(pre.headers["access-control-allow-origin"]).toBe("https://app.example.com");
    expect(pre.headers["access-control-allow-headers"]).toMatch(/Idempotency-Key/i);
    const badPre = await request(app).options("/invoices").set("Origin", "https://evil.example.net").set("Access-Control-Request-Method", "POST");
    expect(badPre.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("limits failed sign-ins, and a correct password does not count", async () => {
    const w = await seedWorld();
    const app = createApp({ rateLimits: true, loginAttempts: 3 });
    const login = (email: string, password: string) => request(app).post("/auth/login").send({ email, password });
    for (let i = 0; i < 4; i++) expect((await login("supplier@t.com", "Passw0rd!x")).status).toBe(200);
    for (let i = 0; i < 3; i++) expect((await login(`nobody${i}@t.com`, "wrong")).status).toBe(401);
    const blocked = await login("supplier@t.com", "Passw0rd!x");
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe("TOO_MANY_ATTEMPTS");
    expect(blocked.body.error).toMatch(/15 minutes/);
    expect(w.users.supplier.email).toBe("supplier@t.com");
  });

  it("answers the health check", async () => {
    const r = await request(createApp()).get("/health");
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, db: "up" });
    expect(Object.keys(r.body).sort()).toEqual(["db", "ok", "uptime"]);
  });

  describe("demo data", () => {
    const opts = { enabled: true, password: "Demo-Pass-1" };

    it("is loaded once, into an empty database", async () => {
      expect(await ensureDemoData({ enabled: false, password: "x" })).toBe("disabled");
      expect(await User.countDocuments()).toBe(0);

      expect(await ensureDemoData(opts)).toBe("seeded");
      expect(await User.countDocuments()).toBe(14);
      expect(await Invoice.countDocuments()).toBe(11);
      expect(await LedgerEntry.countDocuments()).toBeGreaterThan(0);

      expect(await ensureDemoData(opts)).toBe("users-exist");
      expect(await User.countDocuments()).toBe(14);
    });

    it("is created once when two instances start together", async () => {
      const results = await Promise.all([ensureDemoData(opts), ensureDemoData(opts)]);
      expect(results.filter((r) => r === "seeded")).toHaveLength(1);
      expect(await User.countDocuments()).toBe(14);
      expect(await Entity.countDocuments()).toBe(6);
    });

    it("uses the password it was given", async () => {
      await ensureDemoData(opts);
      const ok = await request(createApp()).post("/auth/login").send({ email: "admin@lendchain.test", password: "Demo-Pass-1" });
      expect(ok.status).toBe(200);
      const old = await request(createApp()).post("/auth/login").send({ email: "admin@lendchain.test", password: "Demo@1234" });
      expect(old.status).toBe(401);
    });

    it("can be reset to a clean copy", async () => {
      await ensureDemoData(opts);
      await Entity.create({ kind: "SUPPLIER", legalName: "Added Later", pan: "ABCDE1234Z", gstin: "27ABCDE1234Z1Z5" });
      await Invoice.deleteMany({});
      const r = await resetDemo("Demo-Pass-2");
      expect(r.cleared).toBeGreaterThan(0);
      expect(await Entity.countDocuments({ legalName: "Added Later" })).toBe(0);
      expect(await User.countDocuments()).toBe(14);
      expect(await Invoice.countDocuments()).toBe(11);
      const ok = await request(createApp()).post("/auth/login").send({ email: "admin@lendchain.test", password: "Demo-Pass-2" });
      expect(ok.status).toBe(200);
      expect(await ensureDemoData(opts)).toBe("users-exist");
    });
  });

  it("reports the database as down when it cannot be reached", async () => {
    const app = createApp();
    await mongoose.disconnect();
    const r = await request(app).get("/health");
    expect(r.status).toBe(503);
    expect(r.body).toMatchObject({ ok: false, db: "down" });
  });
});
