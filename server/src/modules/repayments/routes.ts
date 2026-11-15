import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { Invoice, Repayment } from "../../models";
import { authenticate, check } from "../../middleware/auth";
import { badRequest, forbidden, notFound } from "../../shared/errors";
import { move } from "../invoices/service";
import { post } from "../ledger/repository";
import { allocateRepayment, repaymentLines } from "../ledger/posting";
import { releaseLimit } from "../programs/limit";
import { interestFor } from "../../shared/money";
import { audit } from "../../shared/audit";

export const repaymentRouter = Router();
repaymentRouter.use(authenticate);

const PENAL_RATE = 24;

export async function duesFor(inv: any, session?: mongoose.ClientSession) {
  const paid = await Repayment.find({ invoiceId: inv._id }).session(session ?? null).lean();
  const sum = (k: string) => paid.reduce((s, r: any) => s + (r.allocation?.[k] ?? 0), 0);
  const overdueDays = Math.max(0, Math.floor((Date.now() - inv.dueDate.getTime()) / 86400000));
  const penalTotal = interestFor(inv.financedAmount, PENAL_RATE, overdueDays);
  return {
    penal: Math.max(0, penalTotal - sum("penal")),
    fees: 0,
    interest: 0,
    principal: Math.max(0, inv.financedAmount - sum("principal")),
  };
}

repaymentRouter.get("/dues/:invoiceId", async (req, res) => {
  const inv = await Invoice.findById(req.params.invoiceId);
  if (!inv) throw notFound("Invoice");
  check(req, "invoice:read", { supplierId: String(inv.supplierId), buyerId: String(inv.buyerId) });
  res.json(await duesFor(inv));
});

repaymentRouter.post("/", async (req, res) => {
  const body = z.object({ invoiceId: z.string(), amount: z.number().int().positive(), utr: z.string().min(6) }).parse(req.body);
  const inv0 = await Invoice.findById(body.invoiceId);
  if (!inv0) throw notFound("Invoice");
  if (req.actor.role === "BUYER") {
    check(req, "repayment:create", {});
    if (String(inv0.buyerId) !== req.actor.entityId) throw forbidden("NOT_YOUR_INVOICE");
  } else {
    check(req, "repayment:record", {});
  }

  const session = await mongoose.startSession();
  let out: any;
  try {
    await session.withTransaction(async () => {
      const inv = await Invoice.findById(body.invoiceId).session(session);
      if (!inv || !["DISBURSED", "OVERDUE"].includes(inv.status)) throw badRequest("Invoice is not open for repayment");
      const dues = await duesFor(inv, session);
      const { allocated, excess } = allocateRepayment(body.amount, dues);
      if (excess > 0) throw badRequest("Amount is more than what is due", "OVERPAYMENT");
      await Repayment.create([{ invoiceId: inv._id, amount: body.amount, utr: body.utr, allocation: allocated, recordedBy: req.actor.id }], { session });
      await post(`rep-${body.utr}-${Date.now()}`, inv._id, repaymentLines(allocated), "repayment", session);
      const left = dues.principal - allocated.principal + (dues.penal - allocated.penal);
      if (left === 0) {
        await move(inv, "REPAID", req.actor.id, {}, session);
        await releaseLimit(inv.programId, inv.financedAmount!, session);
      }
      out = { allocated, invoiceStatus: inv.status };
    });
  } finally {
    await session.endSession();
  }
  await audit(req, "repayment.record", body.invoiceId, null, out);
  res.status(201).json(out);
});
