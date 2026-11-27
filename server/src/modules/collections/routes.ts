import { Router } from "express";
import { z } from "zod";
import { FollowUp, Invoice } from "../../models";
import { authenticate, check } from "../../middleware/auth";
import { badRequest, notFound } from "../../shared/errors";
import { audit } from "../../shared/audit";
import { ageing } from "../repayments/overdue";

export const collectionsRouter = Router();
collectionsRouter.use(authenticate);

collectionsRouter.get("/collections/ageing", async (req, res) => {
  check(req, "collections:read", {});
  res.json(await ageing());
});

collectionsRouter.get("/collections/follow-ups", async (req, res) => {
  check(req, "collections:read", {});
  const status = z.enum(["OPEN", "DONE"]).optional().parse(req.query.status);
  const rows = await FollowUp.find(status ? { status } : {}).sort({ createdAt: -1 }).limit(200)
    .populate("by", "name").populate("invoiceId", "number status financedAmount buyerId").lean();
  res.json(rows.map((f: any) => ({
    id: f._id, invoiceId: f.invoiceId?._id, number: f.invoiceId?.number, invoiceStatus: f.invoiceId?.status,
    channel: f.channel, note: f.note, promisedOn: f.promisedOn, promisedAmount: f.promisedAmount, nextOn: f.nextOn,
    status: f.status, by: f.by?.name ?? "system", createdAt: f.createdAt, doneAt: f.doneAt,
  })));
});

const followUpBody = z.object({
  invoiceId: z.string(),
  channel: z.enum(["CALL", "EMAIL", "VISIT", "NOTE"]),
  note: z.string().trim().min(3, "Write what happened").max(1000),
  promisedOn: z.coerce.date().optional(),
  promisedAmount: z.number().int().positive().optional(),
  nextOn: z.coerce.date().optional(),
});

collectionsRouter.post("/collections/follow-ups", async (req, res) => {
  check(req, "collections:write", {});
  const body = followUpBody.parse(req.body);
  const inv = await Invoice.findById(body.invoiceId).lean();
  if (!inv) throw notFound("Invoice");
  if (inv.status !== "OVERDUE") throw badRequest("Follow-ups are for overdue invoices");
  if (body.promisedAmount && !body.promisedOn) throw badRequest("Add the date the buyer promised to pay");
  const f = await FollowUp.create({ ...body, by: req.actor.id, status: body.nextOn ? "OPEN" : "DONE", doneAt: body.nextOn ? undefined : new Date() });
  await audit(req, "followup.create", body.invoiceId, null, { channel: body.channel, nextOn: body.nextOn });
  res.status(201).json(f);
});

collectionsRouter.post("/collections/follow-ups/:id/done", async (req, res) => {
  check(req, "collections:write", {});
  const f = await FollowUp.findOneAndUpdate({ _id: req.params.id, status: "OPEN" }, { status: "DONE", doneAt: new Date() }, { returnDocument: "after" });
  if (!f) throw notFound("Open follow-up");
  await audit(req, "followup.done", String(f.invoiceId));
  res.json(f);
});
