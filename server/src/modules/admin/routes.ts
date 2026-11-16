import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Entity, Program, RuleSet, RuleEvaluation, User, AuditLog } from "../../models";
import { authenticate, check, require } from "../../middleware/auth";
import { badRequest, notFound } from "../../shared/errors";
import { evaluate } from "../rules-engine/evaluator";
import { entries, trialBalance } from "../ledger/repository";
import { ageing } from "../repayments/overdue";
import { audit } from "../../shared/audit";

export const adminRouter = Router();
adminRouter.use(authenticate);

const mask = (v: string) => v.slice(0, 2) + "*".repeat(Math.max(0, v.length - 4)) + v.slice(-2);
const panRe = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const gstRe = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

adminRouter.post("/entities", async (req, res) => {
  const body = z.object({
    kind: z.enum(["SUPPLIER", "BUYER"]), legalName: z.string().min(2),
    pan: z.string().regex(panRe, "Invalid PAN"), gstin: z.string().regex(gstRe, "Invalid GSTIN"),
    bankAccount: z.string().optional(), rating: z.string().optional(), vintageMonths: z.number().int().optional(),
  }).parse(req.body);
  check(req, "user:manage", {});
  const e = await Entity.create(body);
  await audit(req, "entity.create", String(e._id));
  res.status(201).json(e);
});

adminRouter.patch("/entities/:id/kyc", async (req, res) => {
  const body = z.object({ status: z.enum(["UNDER_REVIEW", "VERIFIED", "REJECTED"]), remarks: z.string().optional() }).parse(req.body);
  check(req, "entity:verify", {});
  const e = await Entity.findByIdAndUpdate(req.params.id, { kycStatus: body.status, kycRemarks: body.remarks }, { returnDocument: "after" });
  if (!e) throw notFound("Entity");
  await audit(req, "entity.kyc", String(e._id), null, body);
  res.json(e);
});

adminRouter.get("/entities", async (req, res) => {
  const kind = req.query.kind as string | undefined;
  const rows = await Entity.find(kind ? { kind } as Record<string, unknown> : {}).lean();
  const full = req.actor.role === "ADMIN" || req.actor.role === "ANALYST";
  res.json(rows.map((e) => full
    ? { ...e, pan: mask(e.pan), bankAccount: e.bankAccount ? mask(e.bankAccount) : undefined }
    : { _id: e._id, kind: e.kind, legalName: e.legalName, rating: e.rating }));
});

adminRouter.post("/users", async (req, res) => {
  const body = z.object({
    email: z.string().email(), name: z.string().min(2), password: z.string().min(8), role: z.string(),
    entityId: z.string().optional(), approvalLimit: z.number().int().optional(),
  }).parse(req.body);
  check(req, "user:manage", {});
  const u = await User.create({ ...body, passwordHash: await bcrypt.hash(body.password, 10) });
  await audit(req, "user.create", String(u._id));
  res.status(201).json({ id: u._id, email: u.email, role: u.role });
});

adminRouter.post("/programs", async (req, res) => {
  const body = z.object({
    supplierId: z.string(), buyerId: z.string(), sanctioned: z.number().int().positive(),
    maxTenureDays: z.number().int().optional(), baseRate: z.number().optional(),
  }).parse(req.body);
  check(req, "program:manage", {});
  const p = await Program.create(body);
  await audit(req, "program.create", String(p._id));
  res.status(201).json(p);
});

adminRouter.get("/programs/:id/limit", async (req, res) => {
  const p = await Program.findById(req.params.id).lean();
  if (!p) throw notFound("Program");
  res.json({ sanctioned: p.sanctioned, outstanding: p.outstanding, available: p.sanctioned - p.outstanding });
});

adminRouter.get("/programs", async (req, res) => {
  const filter: Record<string, unknown> = {};
  if (req.actor.role === "SUPPLIER") filter.supplierId = req.actor.entityId;
  if (req.actor.role === "BUYER") filter.buyerId = req.actor.entityId;
  res.json(await Program.find(filter).lean());
});

adminRouter.post("/rule-sets", async (req, res) => {
  const body = z.object({ rules: z.array(z.any()), pricing: z.any() }).parse(req.body);
  check(req, "rule:propose", {});
  const last = await RuleSet.findOne().sort({ version: -1 }).lean();
  const rs = await RuleSet.create({ ...body, version: (last?.version ?? 0) + 1, createdBy: req.actor.id });
  await audit(req, "ruleset.propose", String(rs._id));
  res.status(201).json(rs);
});

adminRouter.get("/rule-sets", async (req, res) => {
  check(req, "rule:propose", {});
  res.json(await RuleSet.find().sort({ version: -1 }).lean());
});

adminRouter.post("/rule-sets/:id/publish", async (req, res) => {
  const rs = await RuleSet.findById(req.params.id);
  if (!rs) throw notFound("Rule set");
  check(req, "rule:publish", { createdBy: String(rs.createdBy) });
  if (rs.status !== "DRAFT") throw badRequest("Only a draft can be published");
  await RuleSet.updateMany({ status: "PUBLISHED" }, { status: "ARCHIVED" });
  rs.status = "PUBLISHED";
  rs.publishedBy = req.actor.id as any;
  await rs.save();
  await audit(req, "ruleset.publish", String(rs._id));
  res.json(rs);
});

adminRouter.post("/rule-sets/:id/simulate", async (req, res) => {
  check(req, "rule:propose", {});
  const rs = await RuleSet.findById(req.params.id).lean();
  if (!rs) throw notFound("Rule set");
  const past = await RuleEvaluation.find().sort({ createdAt: -1 }).limit(500).lean();
  let changed = 0;
  const rows = past.map((p: any) => {
    const next = evaluate(rs.rules as any, rs.pricing as any, p.facts);
    const diff = next.decision !== p.result.decision;
    if (diff) changed++;
    return { invoiceId: p.invoiceId, before: p.result.decision, after: next.decision, changed: diff };
  });
  res.json({ total: rows.length, changed, rows });
});

adminRouter.get("/ledger/entries", async (req, res) => {
  check(req, "ledger:read", {});
  res.json({ entries: await entries(), trial: await trialBalance() });
});

adminRouter.get("/audit-logs", async (req, res) => {
  check(req, "audit:read", {});
  res.json(await AuditLog.find().sort({ createdAt: -1 }).limit(200).lean());
});

adminRouter.get("/collections/ageing", async (req, res) => {
  check(req, "collections:read", {});
  res.json(await ageing());
});
