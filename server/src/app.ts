import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
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

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: config.clientUrl.split(","), credentials: true }));
  // the bank webhook reads its own raw body, so it is mounted before the JSON parser
  app.use("/webhooks", webhookRouter);
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  if (process.env.NODE_ENV !== "test") app.use(rateLimit({ windowMs: 60000, limit: 300 }));

  app.get("/health", (_req, res) => res.json({ ok: true }));
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
