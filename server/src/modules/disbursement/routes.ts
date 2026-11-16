import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { Invoice, Disbursement, IdempotencyKey } from "../../models";
import { authenticate, check } from "../../middleware/auth";
import { badRequest, conflict, notFound } from "../../shared/errors";
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

// step one: someone on finance ops queues the payout
disbursementRouter.post("/", async (req, res) => {
  const { invoiceId } = z.object({ invoiceId: z.string() }).parse(req.body);
  const inv = await Invoice.findById(invoiceId);
  if (!inv) throw notFound("Invoice");
  check(req, "disbursement:initiate", { approvedBy: String(inv.approvedBy) });
  if (inv.status !== "APPROVED") throw badRequest("Invoice is not approved for disbursement");
  if (await Disbursement.exists({ invoiceId: inv._id })) throw conflict("A payout is already queued for this invoice");
  let d;
  try {
    d = await Disbursement.create({
      invoiceId: inv._id, amount: inv.financedAmount, status: "PENDING_AUTH", initiatedBy: req.actor.id,
    });
  } catch (e: any) {
    // the unique index on invoiceId decides when two requests race
    if (e?.code === 11000) throw conflict("A payout is already queued for this invoice");
    throw e;
  }
  await audit(req, "disbursement.initiate", invoiceId, null, { disbursementId: String(d._id) });
  res.status(201).json({ disbursement: d.toObject() });
});

disbursementRouter.get("/", async (req, res) => {
  check(req, "disbursement:read", {});
  const rows = await Disbursement.find().sort({ createdAt: -1 }).limit(100).lean();
  res.json(rows);
});

// step two: a different person releases the money
disbursementRouter.post("/:id/authorise", async (req, res) => {
  const key = req.header("Idempotency-Key");
  if (!key) throw badRequest("Idempotency-Key header is required");

  const prior = await IdempotencyKey.findOne({ key }).lean();
  if (prior) return res.json(prior.response);

  const session = await mongoose.startSession();
  let response: any;
  let invoiceId = "";
  try {
    await session.withTransaction(async () => {
      const again = await IdempotencyKey.findOne({ key }).session(session).lean();
      if (again) {
        response = again.response;
        return;
      }
      const d = await Disbursement.findById(req.params.id).session(session);
      if (!d) throw notFound("Disbursement");
      const inv = await Invoice.findById(d.invoiceId).session(session);
      if (!inv) throw notFound("Invoice");
      invoiceId = String(inv._id);
      check(req, "disbursement:authorise", { approvedBy: String(inv.approvedBy), initiatedBy: String(d.initiatedBy) });
      if (d.status !== "PENDING_AUTH") throw conflict("Payout was already released", "ALREADY_AUTHORISED");
      if (inv.status !== "APPROVED") throw badRequest("Invoice is not approved for disbursement");

      const evaluation = await RuleEvaluation.findOne({ invoiceId: inv._id }).sort({ createdAt: -1 }).session(session).lean();
      const result: any = evaluation!.result;
      const advance = inv.financedAmount!;
      const days = Math.max(1, Math.ceil((inv.dueDate.getTime() - Date.now()) / 86400000));
      const upfrontInterest = interestFor(advance, result.rate, days);
      const fee = result.fee;
      const net = advance - fee - upfrontInterest;
      if (net <= 0) throw badRequest("Net disbursal is not positive");

      // one conditional update decides who releases the payout
      const claimed = await Disbursement.updateOne(
        { _id: d._id, status: "PENDING_AUTH" },
        { $set: { amount: advance, fee, upfrontInterest, net, rate: result.rate, status: "SUCCESS", reference: "MOCK-" + Date.now(), authorisedBy: req.actor.id } },
        { session },
      );
      if (claimed.modifiedCount !== 1) throw conflict("Payout was already released", "ALREADY_AUTHORISED");
      const released = await Disbursement.findById(d._id).session(session);
      await post(String(d._id), inv._id, disbursementLines({ advance, fee, upfrontInterest }), "disbursement", session);
      hooks.afterLedger?.();
      await move(inv, "DISBURSED", req.actor.id, { disbursedAt: new Date() }, session);
      response = { disbursement: released!.toObject(), invoiceStatus: inv.status };
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
  await audit(req, "disbursement.authorise", invoiceId, null, { key });
  res.status(201).json(response);
});
