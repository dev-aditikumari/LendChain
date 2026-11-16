import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { Invoice, Disbursement, IdempotencyKey } from "../../models";
import { authenticate, check } from "../../middleware/auth";
import { badRequest, notFound } from "../../shared/errors";
import { move } from "../invoices/service";
import { post } from "../ledger/repository";
import { disbursementLines } from "../ledger/posting";
import { interestFor } from "../../shared/money";
import { RuleEvaluation } from "../../models";
import { audit } from "../../shared/audit";

export const disbursementRouter = Router();
disbursementRouter.use(authenticate);

// tests set this to make a failure after the ledger is written
export const hooks: { afterLedger?: () => void } = {};

disbursementRouter.post("/", async (req, res) => {
  const { invoiceId } = z.object({ invoiceId: z.string() }).parse(req.body);
  const key = req.header("Idempotency-Key");
  if (!key) throw badRequest("Idempotency-Key header is required");

  const prior = await IdempotencyKey.findOne({ key }).lean();
  if (prior) return res.json(prior.response);

  const session = await mongoose.startSession();
  let response: any;
  try {
    await session.withTransaction(async () => {
      const again = await IdempotencyKey.findOne({ key }).session(session).lean();
      if (again) {
        response = again.response;
        return;
      }
      const inv = await Invoice.findById(invoiceId).session(session);
      if (!inv) throw notFound("Invoice");
      check(req, "disbursement:execute", { approvedBy: String(inv.approvedBy) });
      if (inv.status !== "APPROVED") throw badRequest("Invoice is not approved for disbursement");

      const evaluation = await RuleEvaluation.findOne({ invoiceId: inv._id }).sort({ createdAt: -1 }).session(session).lean();
      const result: any = evaluation!.result;
      const advance = inv.financedAmount!;
      const days = Math.max(1, Math.ceil((inv.dueDate.getTime() - Date.now()) / 86400000));
      const upfrontInterest = interestFor(advance, result.rate, days);
      const fee = result.fee;
      const net = advance - fee - upfrontInterest;
      if (net <= 0) throw badRequest("Net disbursal is not positive");

      const [d] = await Disbursement.create([{
        invoiceId: inv._id, amount: advance, fee, upfrontInterest, net, rate: result.rate,
        status: "SUCCESS", reference: "MOCK-" + Date.now(), executedBy: req.actor.id,
      }], { session });
      await post(String(d._id), inv._id, disbursementLines({ advance, fee, upfrontInterest }), "disbursement", session);
      hooks.afterLedger?.();
      await move(inv, "DISBURSED", req.actor.id, { disbursedAt: new Date() }, session);
      response = { disbursement: d.toObject(), invoiceStatus: inv.status };
      await IdempotencyKey.create([{ key, response: JSON.parse(JSON.stringify(response)) }], { session });
    });
  } catch (e: any) {
    // a concurrent request with the same key may have won
    const won = await IdempotencyKey.findOne({ key }).lean();
    if (won) return res.json(won.response);
    throw e;
  } finally {
    await session.endSession();
  }
  await audit(req, "disbursement.execute", invoiceId, null, { key });
  res.status(201).json(response);
});
