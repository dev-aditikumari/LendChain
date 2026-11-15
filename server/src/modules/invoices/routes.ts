import { Router } from "express";
import { z } from "zod";
import { Invoice, Program, Entity, RuleEvaluation, InvoiceEvent } from "../../models";
import { authenticate, check, require } from "../../middleware/auth";
import { invoiceScope } from "../rbac/policy";
import { badRequest, conflict, notFound } from "../../shared/errors";
import { move } from "./service";
import { publishedRuleSet, factsFor } from "../rules-engine/service";
import { evaluate } from "../rules-engine/evaluator";
import { reserveLimit } from "../programs/limit";
import { audit } from "../../shared/audit";

export const invoiceRouter = Router();
invoiceRouter.use(authenticate);

const createBody = z.object({
  number: z.string().min(1),
  buyerId: z.string(),
  amount: z.number().int().positive(),
  gst: z.number().int().min(0).default(0),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date(),
});

async function load(req: any, permission: any) {
  const inv = await Invoice.findById(req.params.id);
  if (!inv) throw notFound("Invoice");
  check(req, permission, { supplierId: String(inv.supplierId), buyerId: String(inv.buyerId), amount: inv.amount });
  return inv;
}

invoiceRouter.post("/", require("invoice:create"), async (req, res) => {
  const body = createBody.parse(req.body);
  if (body.dueDate <= body.issueDate) throw badRequest("Due date must be after issue date");
  const supplierId = req.actor.entityId;
  const program = await Program.findOne({ supplierId, buyerId: body.buyerId });
  if (!program) throw badRequest("No program between you and this buyer", "NO_PROGRAM");
  const dup = await Invoice.findOne({ buyerId: body.buyerId, number: body.number, amount: body.amount, issueDate: body.issueDate });
  if (dup) throw conflict("Duplicate invoice", "DUPLICATE_INVOICE");
  const inv = await Invoice.create({ ...body, supplierId, programId: program._id, createdBy: req.actor.id });
  await audit(req, "invoice.create", String(inv._id), null, inv.toObject());
  res.status(201).json(inv);
});

invoiceRouter.get("/", require("invoice:read"), async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const filter: Record<string, unknown> = { ...invoiceScope(req.actor) };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.cursor) filter._id = { $lt: req.query.cursor };
  const items = await Invoice.find(filter).sort({ _id: -1 }).limit(limit).lean();
  res.json({ items, nextCursor: items.length === limit ? items[items.length - 1]._id : null });
});

invoiceRouter.get("/:id", async (req, res) => {
  const inv = await load(req, "invoice:read");
  const [events, evaluation] = await Promise.all([
    InvoiceEvent.find({ invoiceId: inv._id }).sort({ createdAt: 1 }).lean(),
    RuleEvaluation.findOne({ invoiceId: inv._id }).sort({ createdAt: -1 }).lean(),
  ]);
  res.json({ invoice: inv, events, evaluation });
});

invoiceRouter.post("/:id/submit", async (req, res) => {
  const inv = await load(req, "invoice:submit");
  await move(inv, "SUBMITTED", req.actor.id);
  await audit(req, "invoice.submit", String(inv._id));
  res.json(inv);
});

invoiceRouter.post("/:id/confirm", async (req, res) => {
  const inv = await load(req, "invoice:confirm");
  await move(inv, "BUYER_CONFIRMED", req.actor.id);
  await audit(req, "invoice.confirm", String(inv._id));
  res.json(inv);
});

invoiceRouter.post("/:id/dispute", async (req, res) => {
  const { reason } = z.object({ reason: z.string().min(3) }).parse(req.body);
  const inv = await load(req, "invoice:confirm");
  await move(inv, "DISPUTED", req.actor.id, { disputeReason: reason }, undefined, reason);
  await audit(req, "invoice.dispute", String(inv._id), null, { reason });
  res.json(inv);
});

invoiceRouter.post("/:id/financing-requests", async (req, res) => {
  const { advancePercent } = z.object({ advancePercent: z.number().min(1).max(100).optional() }).parse(req.body ?? {});
  const inv = await load(req, "financing:request");
  await move(inv, "FINANCING_REQUESTED", req.actor.id);

  const rs = await publishedRuleSet();
  const facts = await factsFor(inv);
  const pricing: any = { ...rs.pricing };
  if (advancePercent) pricing.defaultAdvancePercent = advancePercent;
  const result = evaluate(rs.rules as any, pricing, facts);
  const evaluation = await RuleEvaluation.create({ invoiceId: inv._id, ruleSetVersion: rs.version, facts, result });

  if (result.decision === "REJECT") {
    await move(inv, "ENGINE_EVALUATED", req.actor.id, { tenureDays: facts.tenureDays });
    await move(inv, "REJECTED", req.actor.id, {}, undefined, result.reasons.join(","));
    await audit(req, "invoice.engine-reject", String(inv._id), null, result);
    return res.json({ invoice: inv, evaluation });
  }

  const financed = Math.round((inv.amount * result.advancePercent) / 100);
  const program = await reserveLimit(inv.programId, financed);
  if (!program) {
    await move(inv, "ENGINE_EVALUATED", req.actor.id);
    await move(inv, "REJECTED", req.actor.id, {}, undefined, "LIMIT_EXCEEDED");
    throw conflict("Program limit would be exceeded", "LIMIT_EXCEEDED");
  }
  await move(inv, "ENGINE_EVALUATED", req.actor.id, { advancePercent: result.advancePercent, financedAmount: financed, tenureDays: facts.tenureDays as number });
  await audit(req, "invoice.engine-evaluate", String(inv._id), null, { decision: result.decision, version: rs.version });
  res.json({ invoice: inv, evaluation });
});
