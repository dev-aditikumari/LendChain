import { Router } from "express";
import { z } from "zod";
import { Invoice } from "../../models";
import { authenticate, check } from "../../middleware/auth";
import { badRequest, notFound } from "../../shared/errors";
import { move } from "../invoices/service";
import { releaseLimit } from "../programs/limit";
import { audit } from "../../shared/audit";

export const creditRouter = Router();
creditRouter.use(authenticate);

creditRouter.get("/queue", async (req, res) => {
  check(req, "credit:review", {});
  const items = await Invoice.find({ status: "ENGINE_EVALUATED" }).sort({ createdAt: 1 }).lean();
  res.json(items);
});

creditRouter.post("/:invoiceId/recommend", async (req, res) => {
  const body = z.object({ recommendation: z.enum(["APPROVE", "REJECT"]), notes: z.string().min(3) }).parse(req.body);
  check(req, "credit:review", {});
  const inv = await Invoice.findById(req.params.invoiceId);
  if (!inv) throw notFound("Invoice");
  if (inv.status !== "ENGINE_EVALUATED") throw badRequest("Invoice is not waiting for review");
  inv.recommendedBy = req.actor.id as any;
  inv.recommendation = body.recommendation;
  await inv.save();
  await audit(req, "credit.recommend", String(inv._id), null, body);
  res.json(inv);
});

creditRouter.post("/:invoiceId/decision", async (req, res) => {
  const body = z.object({ decision: z.enum(["APPROVE", "REJECT"]), remarks: z.string().min(3) }).parse(req.body);
  const inv = await Invoice.findById(req.params.invoiceId);
  if (!inv) throw notFound("Invoice");
  if (!inv.recommendedBy) throw badRequest("Needs an analyst recommendation first");
  check(req, "invoice:approve", {
    amount: inv.financedAmount ?? inv.amount,
    createdBy: String(inv.createdBy),
    recommendedBy: String(inv.recommendedBy),
  });
  if (body.decision === "APPROVE") {
    await move(inv, "APPROVED", req.actor.id, { approvedBy: req.actor.id }, undefined, body.remarks);
  } else {
    await move(inv, "REJECTED", req.actor.id, {}, undefined, body.remarks);
    await releaseLimit(inv.programId, inv.financedAmount ?? 0);
  }
  await audit(req, `credit.${body.decision.toLowerCase()}`, String(inv._id), null, body);
  res.json(inv);
});
