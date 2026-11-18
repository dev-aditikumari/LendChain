import { Router } from "express";
import { z } from "zod";
import { Disbursement, ExceptionItem, Invoice, Statement, StatementLine, User } from "../../models";
import { authenticate, check } from "../../middleware/auth";
import { badRequest, conflict, forbidden, notFound } from "../../shared/errors";
import { audit } from "../../shared/audit";
import { queuePayout } from "../disbursement/routes";
import { saveStatement, sampleStatement, unmatchedLedger } from "./reconciliation";

export const operationsRouter = Router();
operationsRouter.use(authenticate);

const names = async (ids: unknown[]) => {
  const users = await User.find({ _id: { $in: ids.filter(Boolean) } }, "name").lean();
  return new Map(users.map((u: any) => [String(u._id), u.name as string]));
};

// ---- exceptions ----

operationsRouter.get("/exceptions", async (req, res) => {
  check(req, "disbursement:read", {});
  const { status } = z.object({ status: z.enum(["OPEN", "RESOLVED", "all"]).default("all") }).parse(req.query);
  const rows = await ExceptionItem.find(status === "all" ? {} : { status }).sort({ status: -1, createdAt: -1 }).limit(200)
    .populate("invoiceId", "number status").lean();
  const who = await names(rows.flatMap((r) => [r.owner, r.resolvedBy]));
  res.json(rows.map((r: any) => ({
    ...r,
    invoiceNumber: r.invoiceId?.number,
    invoiceStatus: r.invoiceId?.status,
    invoiceId: r.invoiceId?._id,
    ownerName: r.owner ? who.get(String(r.owner)) : undefined,
    resolvedByName: r.resolvedBy ? who.get(String(r.resolvedBy)) : undefined,
  })));
});

async function openException(id: string) {
  const e = await ExceptionItem.findById(id);
  if (!e) throw notFound("Exception");
  if (e.status !== "OPEN") throw conflict("This exception is already resolved", "ALREADY_RESOLVED");
  return e;
}

operationsRouter.post("/exceptions/:id/assign", async (req, res) => {
  check(req, "exception:resolve", {});
  const e = await openException(req.params.id);
  e.owner = req.actor.id as any;
  await e.save();
  await audit(req, "exception.assign", String(e._id));
  res.json(e);
});

// queues the payout again; a different person still has to authorise it
operationsRouter.post("/exceptions/:id/retry", async (req, res) => {
  check(req, "exception:resolve", {});
  const e = await openException(req.params.id);
  if (e.kind !== "PAYOUT_FAILED" || !e.invoiceId) throw badRequest("Only a failed payout can be retried");
  const inv = await Invoice.findById(e.invoiceId);
  if (!inv) throw notFound("Invoice");
  const failed = e.disbursementId ? await Disbursement.findById(e.disbursementId) : null;
  if (failed?.status === "SUCCESS") throw badRequest("The bank reports this payout failed after release, so it cannot be queued again. Resolve it once the money is recovered.", "CANNOT_RETRY");
  // whoever approved the invoice may not move its money
  if (String(inv.approvedBy) === req.actor.id) throw forbidden("SEGREGATION_OF_DUTIES");
  const d = await queuePayout(inv, req.actor.id);
  e.retryDisbursementId = d._id as any;
  e.owner = e.owner ?? (req.actor.id as any);
  await e.save();
  await audit(req, "exception.retry", String(e._id), null, { disbursementId: String(d._id) });
  res.status(201).json({ disbursement: d.toObject() });
});

operationsRouter.post("/exceptions/:id/resolve", async (req, res) => {
  check(req, "exception:resolve", {});
  const { note } = z.object({ note: z.string().trim().min(5, "Write what was done (at least 5 characters)").max(300) }).parse(req.body);
  const e = await openException(req.params.id);
  e.status = "RESOLVED";
  e.resolution = note;
  e.resolvedBy = req.actor.id as any;
  e.resolvedAt = new Date();
  await e.save();
  await audit(req, "exception.resolve", String(e._id), null, { note });
  res.json(e);
});

// ---- reconciliation ----

operationsRouter.get("/reconciliation/statements", async (req, res) => {
  check(req, "reconciliation:read", {});
  const sts = await Statement.find().sort({ createdAt: -1 }).limit(50).lean();
  const counts = await StatementLine.aggregate([
    { $match: { statementId: { $in: sts.map((s) => s._id) } } },
    { $group: { _id: { s: "$statementId", status: "$status" }, n: { $sum: 1 } } },
  ]);
  const who = await names(sts.map((s) => s.uploadedBy));
  res.json(sts.map((s) => {
    const n = (status: string) => counts.find((c) => String(c._id.s) === String(s._id) && c._id.status === status)?.n ?? 0;
    return { ...s, matched: n("MATCHED"), unmatched: n("UNMATCHED"), uploadedByName: who.get(String(s.uploadedBy)) };
  }));
});

operationsRouter.post("/reconciliation/statements", async (req, res) => {
  check(req, "reconciliation:upload", {});
  const { name, csv } = z.object({ name: z.string().trim().min(1).max(120), csv: z.string().min(1).max(900_000) }).parse(req.body);
  const st = await saveStatement(name, csv, req.actor.id);
  await audit(req, "reconciliation.upload", String(st._id), null, { name, lines: st.lineCount });
  res.status(201).json(st);
});

operationsRouter.get("/reconciliation/statements/:id", async (req, res) => {
  check(req, "reconciliation:read", {});
  const st = await Statement.findById(req.params.id).lean();
  if (!st) throw notFound("Statement");
  const lines = await StatementLine.find({ statementId: st._id }).sort({ date: 1, _id: 1 }).lean();
  const missing = await unmatchedLedger(st.from!, st.to!);
  const invoices = await Invoice.find({ _id: { $in: missing.map((m) => m.invoiceId).filter(Boolean) as any[] } }, "number").lean();
  const numbers = new Map(invoices.map((i: any) => [String(i._id), i.number as string]));
  res.json({
    statement: st,
    summary: {
      lines: lines.length,
      matched: lines.filter((l) => l.status === "MATCHED").length,
      unmatched: lines.filter((l) => l.status === "UNMATCHED").length,
      unmatchedLedger: missing.length,
    },
    lines,
    unmatchedLedger: missing.map((m) => ({ ...m, invoiceNumber: m.invoiceId ? numbers.get(String(m.invoiceId)) : undefined })),
  });
});

// demo only: a statement generated from the ledger, with a few differences left in
operationsRouter.get("/reconciliation/sample-statement", async (req, res) => {
  check(req, "reconciliation:upload", {});
  res.type("text/csv").send(await sampleStatement());
});
