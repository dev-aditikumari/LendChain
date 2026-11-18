import { createHmac, timingSafeEqual } from "crypto";
import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { Disbursement } from "../../models";
import { config } from "../../config";
import { raise } from "./exceptions";

export const webhookRouter = Router();
if (process.env.NODE_ENV !== "test") webhookRouter.use(rateLimit({ windowMs: 60000, limit: 120 }));

const event = z.object({
  event: z.enum(["payout.confirmed", "payout.failed"]),
  reference: z.string().min(1).max(60),
  reason: z.string().max(200).optional(),
});

const sign = (body: Buffer) => "sha256=" + createHmac("sha256", config.bankWebhookSecret).update(body).digest("hex");

function signatureOk(header: string | undefined, body: Buffer) {
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(sign(body));
  return a.length === b.length && timingSafeEqual(a, b);
}

// The bank calls this with a signed body. Anything it cannot trust or place becomes an exception for Operations.
// The body is read raw because the signature covers the exact bytes.
webhookRouter.post("/bank", express.raw({ type: () => true, limit: "64kb" }), async (req, res) => {
  // a hosted deployment must set its own secret; the development default is public
  if (process.env.NODE_ENV === "production" && !process.env.BANK_WEBHOOK_SECRET) return res.status(503).json({ error: "Webhook secret is not configured" });
  const body: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  const problem = async (status: number, title: string, detail: string) => {
    await raise({ kind: "WEBHOOK_PROBLEM", severity: "MEDIUM", title, detail });
    return res.status(status).json({ error: title });
  };

  if (!signatureOk(req.header("x-signature"), body)) return problem(401, "Bank webhook rejected", "The signature did not match, so the body was ignored.");

  let parsed;
  try {
    parsed = event.parse(JSON.parse(body.toString("utf8")));
  } catch {
    return problem(400, "Bank webhook could not be read", "The body is not a valid payout event.");
  }

  const d = await Disbursement.findOne({ reference: parsed.reference, status: "SUCCESS" });
  if (!d) return problem(404, "Bank webhook for an unknown payout", `No released payout has the reference ${parsed.reference}.`);

  if (parsed.event === "payout.confirmed") {
    if (d.bankStatus !== "FAILED") await Disbursement.updateOne({ _id: d._id }, { $set: { bankStatus: "CONFIRMED" } });
    return res.json({ ok: true });
  }

  // the bank says a payout that was released did not land: money may need to be recovered by hand
  if (d.bankStatus !== "FAILED") {
    await Disbursement.updateOne({ _id: d._id }, { $set: { bankStatus: "FAILED", failureReason: parsed.reason } });
    await raise({
      kind: "PAYOUT_FAILED", severity: "HIGH", title: "Bank reported a failed payout",
      detail: `Reference ${parsed.reference} was released but the bank reports it failed${parsed.reason ? `: ${parsed.reason}` : ""}.`,
      invoiceId: d.invoiceId, disbursementId: d._id,
    });
  }
  res.json({ ok: true });
});
