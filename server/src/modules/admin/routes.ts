import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Entity, Program, User, AuditLog, Invoice, InvoiceEvent } from "../../models";
import { authenticate, check } from "../../middleware/auth";
import { badRequest, notFound } from "../../shared/errors";
import { ageing } from "../repayments/overdue";
import { audit } from "../../shared/audit";
import { rolePermissions } from "../rbac/permissions";
import { invoiceScope } from "../rbac/policy";

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

adminRouter.get("/entities/mine", async (req, res) => {
  const e = req.actor.entityId ? await Entity.findById(req.actor.entityId).lean() : null;
  if (!e) throw notFound("Entity");
  res.json({ ...e, pan: mask(e.pan), bankAccount: e.bankAccount ? mask(e.bankAccount) : undefined });
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
  const rows = await Program.find(filter).populate("supplierId buyerId", "legalName").lean();
  res.json(rows.map((p: any) => ({
    ...p,
    supplierName: p.supplierId?.legalName,
    buyerName: p.buyerId?.legalName,
    supplierId: p.supplierId?._id,
    buyerId: p.buyerId?._id,
  })));
});

adminRouter.get("/audit-logs", async (req, res) => {
  check(req, "audit:read", {});
  res.json(await AuditLog.find().sort({ createdAt: -1 }).limit(200).populate("actor", "name").lean());
});

adminRouter.get("/collections/ageing", async (req, res) => {
  check(req, "collections:read", {});
  res.json(await ageing());
});

adminRouter.get("/access/roles", async (req, res) => {
  check(req, "user:manage", {});
  res.json(rolePermissions);
});

// recent invoice events for the invoices this user is allowed to see
adminRouter.get("/notifications", async (req, res) => {
  check(req, "invoice:read", {});
  const mine = await Invoice.find(invoiceScope(req.actor)).select("number").lean();
  const numbers = new Map(mine.map((i) => [String(i._id), i.number]));
  const events = await InvoiceEvent.find({ invoiceId: { $in: [...numbers.keys()] } })
    .sort({ createdAt: -1 }).limit(30).populate("actor", "name").lean();
  res.json(events.map((e: any) => ({
    id: e._id, at: e.createdAt, invoiceId: e.invoiceId, number: numbers.get(String(e.invoiceId)),
    from: e.from, to: e.to, by: e.actor?.name ?? "system", note: e.note,
  })));
});
