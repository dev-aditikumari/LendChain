import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Entity, Program, User, AuditLog, Invoice, InvoiceEvent } from "../../models";
import { authenticate, check } from "../../middleware/auth";
import { badRequest, conflict, notFound } from "../../shared/errors";
import { audit } from "../../shared/audit";
import { ROLES, rolePermissions } from "../rbac/permissions";
import { can, invoiceScope } from "../rbac/policy";

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

const roleEnum = z.enum(ROLES as [string, ...string[]]);
const publicUser = (u: any) => ({
  id: u._id, email: u.email, name: u.name, role: u.role, entityId: u.entityId, approvalLimit: u.approvalLimit,
  active: u.active, locked: !!u.lockedUntil && new Date(u.lockedUntil) > new Date(), createdAt: u.createdAt,
});

adminRouter.get("/users", async (req, res) => {
  check(req, "user:manage", {});
  const rows = await User.find().sort({ role: 1, email: 1 }).populate("entityId", "legalName").lean();
  res.json(rows.map((u: any) => ({ ...publicUser(u), entityId: u.entityId?._id, entityName: u.entityId?.legalName })));
});

adminRouter.post("/users", async (req, res) => {
  const body = z.object({
    email: z.string().email(), name: z.string().min(2), password: z.string().min(8), role: roleEnum,
    entityId: z.string().optional(), approvalLimit: z.number().int().optional(),
  }).parse(req.body);
  check(req, "user:manage", {});
  if ((body.role === "SUPPLIER" || body.role === "BUYER") && !body.entityId) throw badRequest("Pick the company this user works for");
  if (await User.exists({ email: body.email.toLowerCase() })) throw conflict("A user with this email already exists");
  const u = await User.create({ ...body, passwordHash: await bcrypt.hash(body.password, 10) });
  await audit(req, "user.create", String(u._id), null, { email: u.email, role: u.role });
  res.status(201).json(publicUser(u));
});

// changes to a person's access end their current sessions
adminRouter.patch("/users/:id", async (req, res) => {
  check(req, "user:manage", {});
  const body = z.object({
    role: roleEnum.optional(), active: z.boolean().optional(), name: z.string().min(2).optional(),
    approvalLimit: z.number().int().positive().nullable().optional(),
  }).parse(req.body);
  const u = await User.findById(req.params.id);
  if (!u) throw notFound("User");
  const self = String(u._id) === req.actor.id;
  if (self && (body.active === false || (body.role && body.role !== u.role))) throw badRequest("You cannot change your own role or deactivate yourself", "OWN_ACCOUNT");
  const losesAdmin = u.role === "ADMIN" && u.active && (body.active === false || (body.role && body.role !== "ADMIN"));
  if (losesAdmin && (await User.countDocuments({ role: "ADMIN", active: true })) <= 1) throw conflict("There must be at least one active admin", "LAST_ADMIN");
  if ((body.role === "SUPPLIER" || body.role === "BUYER") && !u.entityId) throw badRequest("Supplier and buyer users must belong to a company");
  const before = { role: u.role, active: u.active, approvalLimit: u.approvalLimit };
  if (body.role !== undefined) u.role = body.role;
  if (body.active !== undefined) u.active = body.active;
  if (body.name !== undefined) u.name = body.name;
  if (body.approvalLimit !== undefined) u.approvalLimit = body.approvalLimit ?? undefined;
  if (body.role !== undefined || body.active !== undefined) u.tokenVersion += 1;
  await u.save();
  await audit(req, "user.update", String(u._id), before, body);
  res.json(publicUser(u));
});

adminRouter.post("/users/:id/unlock", async (req, res) => {
  check(req, "user:manage", {});
  const u = await User.findByIdAndUpdate(req.params.id, { failedLogins: 0, $unset: { lockedUntil: 1 } }, { returnDocument: "after" });
  if (!u) throw notFound("User");
  await audit(req, "user.unlock", String(u._id));
  res.json(publicUser(u));
});

adminRouter.post("/users/:id/password", async (req, res) => {
  check(req, "user:manage", {});
  const { password } = z.object({ password: z.string().min(8) }).parse(req.body);
  const u = await User.findById(req.params.id);
  if (!u) throw notFound("User");
  u.passwordHash = await bcrypt.hash(password, 10);
  u.tokenVersion += 1;
  u.failedLogins = 0;
  u.lockedUntil = undefined;
  await u.save();
  await audit(req, "user.password-reset", String(u._id));
  res.json(publicUser(u));
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
  const q = z.object({
    action: z.string().max(60).optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional(),
    limit: z.coerce.number().int().min(1).max(500).default(200),
  }).parse(req.query);
  const filter: Record<string, unknown> = {};
  // "invoice" matches invoice.create, invoice.submit and so on
  if (q.action) filter.action = { $regex: `^${q.action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` };
  if (q.from || q.to) filter.createdAt = { ...(q.from && { $gte: q.from }), ...(q.to && { $lte: q.to }) };
  res.json(await AuditLog.find(filter).sort({ createdAt: -1 }).limit(q.limit).populate("actor", "name").lean());
});

adminRouter.get("/access/roles", async (req, res) => {
  check(req, "user:manage", {});
  res.json(rolePermissions);
});

// recent invoice events for the invoices this user is allowed to see, with what is new since they last looked
adminRouter.get("/notifications", async (req, res) => {
  check(req, "invoice:read", {});
  const me = await User.findById(req.actor.id).select("notificationsSeenAt").lean();
  const seen = me?.notificationsSeenAt ? new Date(me.notificationsSeenAt).getTime() : 0;
  const mine = await Invoice.find(invoiceScope(req.actor)).select("number").lean();
  const numbers = new Map(mine.map((i) => [String(i._id), i.number]));
  const events = await InvoiceEvent.find({ invoiceId: { $in: [...numbers.keys()] } })
    .sort({ createdAt: -1 }).limit(30).populate("actor", "name").lean();
  res.json(events.map((e: any) => ({
    id: e._id, at: e.createdAt, invoiceId: e.invoiceId, number: numbers.get(String(e.invoiceId)),
    from: e.from, to: e.to, by: e.actor?.name ?? "system", note: e.note,
    unread: new Date(e.createdAt).getTime() > seen && String(e.actor?._id) !== req.actor.id,
  })));
});

adminRouter.get("/notifications/unread", async (req, res) => {
  const p = can(req.actor, "invoice:read");
  if (!p.ok) return res.json({ count: 0 });
  const me = await User.findById(req.actor.id).select("notificationsSeenAt").lean();
  const mine = await Invoice.find(invoiceScope(req.actor)).select("_id").lean();
  const count = await InvoiceEvent.countDocuments({
    invoiceId: { $in: mine.map((i) => i._id) }, actor: { $ne: req.actor.id },
    ...(me?.notificationsSeenAt && { createdAt: { $gt: me.notificationsSeenAt } }),
  });
  res.json({ count });
});

adminRouter.post("/notifications/read", async (req, res) => {
  await User.updateOne({ _id: req.actor.id }, { notificationsSeenAt: new Date() });
  res.json({ ok: true });
});
