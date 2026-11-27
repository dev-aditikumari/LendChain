import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { ZodError } from "zod";
import { config } from "./config";
import { HttpError } from "./shared/errors";
import { authRouter } from "./modules/auth/routes";
import { invoiceRouter } from "./modules/invoices/routes";
import { creditRouter } from "./modules/credit/routes";
import { disbursementRouter } from "./modules/disbursement/routes";
import { repaymentRouter } from "./modules/repayments/routes";
import { ruleSetRouter } from "./modules/rules-engine/routes";
import { ledgerRouter } from "./modules/ledger/routes";
import { operationsRouter } from "./modules/operations/routes";
import { webhookRouter } from "./modules/operations/webhooks";
import { adminRouter } from "./modules/admin/routes";

export interface AppOptions {
  // browsers may call the API from these origins only
  clientOrigins?: string[];
  // rate limits are off in tests unless asked for
  rateLimits?: boolean;
  loginAttempts?: number;
}

export function createApp(options: AppOptions = {}) {
  const origins = options.clientOrigins ?? config.clientOrigins;
  const limits = options.rateLimits ?? process.env.NODE_ENV !== "test";
  const app = express();
  app.set("trust proxy", config.trustProxy);
  app.use(helmet());
  app.use(
    cors({
      origin: origins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Authorization", "Content-Type", "Idempotency-Key", "X-Request-Id"],
      maxAge: 600,
    }),
  );
  // the bank webhook reads its own raw body, so it is mounted before the JSON parser
  app.use("/webhooks", webhookRouter);
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  if (limits) app.use(rateLimit({ windowMs: 60000, limit: 300 }));

  // failed logins only: a correct password does not count against the person
  if (limits) {
    app.use(
      "/auth/login",
      rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: options.loginAttempts ?? 10,
        skipSuccessfulRequests: true,
        standardHeaders: "draft-7",
        legacyHeaders: false,
        message: { error: "Too many sign-in attempts. Try again in 15 minutes.", code: "TOO_MANY_ATTEMPTS" },
      }),
    );
  }

  // for the host's health check: 200 when the API can reach its database, 503 when it cannot
  app.get("/health", async (_req, res) => {
    let db = false;
    try {
      await mongoose.connection.db?.admin().ping();
      db = mongoose.connection.readyState === 1;
    } catch {
      db = false;
    }
    res.status(db ? 200 : 503).json({ ok: db, db: db ? "up" : "down", uptime: Math.round(process.uptime()) });
  });
  app.use("/auth", authRouter);
  app.use("/invoices", invoiceRouter);
  app.use("/approvals", creditRouter);
  app.use("/disbursements", disbursementRouter);
  app.use("/repayments", repaymentRouter);
  app.use("/rule-sets", ruleSetRouter);
  app.use("/ledger", ledgerRouter);
  app.use("/", operationsRouter);
  app.use("/", adminRouter);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) return res.status(400).json({ error: "Validation failed", issues: err.issues });
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, code: err.code });
    if ((err as any)?.message?.startsWith("Illegal invoice transition")) return res.status(409).json({ error: (err as Error).message });
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  });
  return app;
}
