import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { createHmac } from "crypto";
import { app, as, disburse, resetDb, seedWorld, startDb, stopDb, toApproved } from "./helpers";
import { Disbursement, Entity, ExceptionItem, Invoice, LedgerEntry } from "../src/models";
import { config } from "../src/config";

let w: Awaited<ReturnType<typeof seedWorld>>;

beforeAll(startDb);
afterAll(stopDb);
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
});

const closedAccount = () => Entity.updateOne({ _id: w.supplier._id }, { bankAccount: "50100000000000" });
const openAccount = () => Entity.updateOne({ _id: w.supplier._id }, { bankAccount: "50100234567891" });

async function repay(id: string, utr: string) {
  const dues = await request(app).get(`/repayments/dues/${id}`).set(as(w.tokens.buyer));
  return request(app).post("/repayments").set(as(w.tokens.buyer)).send({ invoiceId: id, amount: dues.body.principal, utr });
}

const sign = (raw: string, secret = config.bankWebhookSecret) => "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
const hook = (payload: unknown, signature?: string) => {
  const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
  const r = request(app).post("/webhooks/bank").set("Content-Type", "application/json");
  return r.set("x-signature", signature ?? sign(raw)).send(raw);
};

describe("failed payouts and exceptions", () => {
  it("a refused transfer lands in the exception queue, and a retry that goes through resolves it", async () => {
    await closedAccount();
    const { id } = await toApproved(w, "F-1");
    const { authorise } = await disburse(w, id, "fail-1");
    expect(authorise.status).toBe(502);
    expect(authorise.body.code).toBe("PAYOUT_FAILED");

    const failed = await Disbursement.findOne({ invoiceId: id });
    expect(failed!.status).toBe("FAILED");
    expect(failed!.failureReason).toMatch(/closed/);
    expect((await Invoice.findById(id))!.status).toBe("APPROVED");
    expect(await LedgerEntry.countDocuments({ invoiceId: id })).toBe(0);

    const list = await request(app).get("/exceptions?status=OPEN").set(as(w.tokens.ops));
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ kind: "PAYOUT_FAILED", status: "OPEN", severity: "HIGH", invoiceNumber: "F-1" });
    const exId = list.body[0]._id;

    expect((await request(app).post(`/exceptions/${exId}/retry`).set(as(w.tokens.finance))).status).toBe(403);
    expect((await request(app).post(`/exceptions/${exId}/retry`).set(as(w.tokens.approver))).status).toBe(403);

    // the retry queues a new payout; someone else still has to release it
    const retry = await request(app).post(`/exceptions/${exId}/retry`).set(as(w.tokens.ops));
    expect(retry.status).toBe(201);
    const next = retry.body.disbursement._id;
    const stillBad = await request(app).post(`/disbursements/${next}/authorise`).set(as(w.tokens.finance)).set("Idempotency-Key", "retry-bad");
    expect(stillBad.status).toBe(502);
    expect((await request(app).get("/exceptions?status=OPEN").set(as(w.tokens.ops))).body.length).toBe(2);

    await openAccount();
    const again = await request(app).post("/exceptions/" + (await ExceptionItem.findOne({ disbursementId: next }))!._id + "/retry").set(as(w.tokens.ops));
    expect(again.status).toBe(201);
    const ok = await request(app).post(`/disbursements/${again.body.disbursement._id}/authorise`).set(as(w.tokens.finance2)).set("Idempotency-Key", "retry-good");
    expect(ok.status).toBe(201);
    expect((await Invoice.findById(id))!.status).toBe("DISBURSED");

    const open = await request(app).get("/exceptions?status=OPEN").set(as(w.tokens.ops));
    expect(open.body).toHaveLength(0);
    const resolved = await request(app).get("/exceptions?status=RESOLVED").set(as(w.tokens.ops));
    expect(resolved.body).toHaveLength(2);
    expect(resolved.body[0].resolution).toMatch(/later attempt/);
  });

  it("can be assigned and resolved by hand with a note, once", async () => {
    await closedAccount();
    const { id } = await toApproved(w, "F-2");
    await disburse(w, id, "fail-2");
    const ex = (await ExceptionItem.findOne())!;

    const assigned = await request(app).post(`/exceptions/${ex._id}/assign`).set(as(w.tokens.ops));
    expect(assigned.body.owner).toBe(String(w.users.ops._id));
    expect((await request(app).post(`/exceptions/${ex._id}/resolve`).set(as(w.tokens.ops)).send({ note: "ok" })).status).toBe(400);
    expect((await request(app).post(`/exceptions/${ex._id}/resolve`).set(as(w.tokens.supplier)).send({ note: "paid by hand outside" })).status).toBe(403);
    const done = await request(app).post(`/exceptions/${ex._id}/resolve`).set(as(w.tokens.ops)).send({ note: "Supplier paid by hand" });
    expect(done.status).toBe(200);
    expect(done.body.status).toBe("RESOLVED");
    expect((await request(app).post(`/exceptions/${ex._id}/resolve`).set(as(w.tokens.ops)).send({ note: "Supplier paid by hand" })).status).toBe(409);
    expect((await request(app).post(`/exceptions/${ex._id}/retry`).set(as(w.tokens.ops))).status).toBe(409);
  });
});

describe("bank webhook", () => {
  it("turns anything it cannot trust into an exception", async () => {
    const bad = await hook({ event: "payout.confirmed", reference: "X" }, "sha256=00");
    expect(bad.status).toBe(401);
    const unsigned = await request(app).post("/webhooks/bank").set("Content-Type", "application/json").send("{}");
    expect(unsigned.status).toBe(401);
    expect((await hook("not json")).status).toBe(400);
    expect((await hook({ event: "payout.exploded", reference: "X" })).status).toBe(400);
    const unknown = await hook({ event: "payout.confirmed", reference: "LCPAYNOPE0000" });
    expect(unknown.status).toBe(404);

    const list = await request(app).get("/exceptions?status=OPEN").set(as(w.tokens.ops));
    expect(list.body).toHaveLength(5);
    expect(list.body.every((e: any) => e.kind === "WEBHOOK_PROBLEM")).toBe(true);
  });

  it("records a bank confirmation, and a bank failure after release raises one exception", async () => {
    const { id } = await toApproved(w, "W-1");
    await disburse(w, id, "w-1");
    const d = (await Disbursement.findOne({ invoiceId: id }))!;

    expect((await hook({ event: "payout.confirmed", reference: d.reference })).status).toBe(200);
    expect((await Disbursement.findById(d._id))!.bankStatus).toBe("CONFIRMED");
    expect(await ExceptionItem.countDocuments()).toBe(0);

    const failed = { event: "payout.failed", reference: d.reference, reason: "Returned by beneficiary bank" };
    expect((await hook(failed)).status).toBe(200);
    expect((await hook(failed)).status).toBe(200);
    expect((await Disbursement.findById(d._id))!.bankStatus).toBe("FAILED");
    const ex = await ExceptionItem.find();
    expect(ex).toHaveLength(1);
    expect(ex[0]).toMatchObject({ kind: "PAYOUT_FAILED", severity: "HIGH" });
    // the bank reported it after release, so a retry would pay twice
    const retry = await request(app).post(`/exceptions/${ex[0]._id}/retry`).set(as(w.tokens.ops));
    expect(retry.status).toBe(400);
    expect(retry.body.code).toBe("CANNOT_RETRY");
  });
});

describe("reconciliation", () => {
  async function threeCashEntries() {
    const a = await toApproved(w, "R-1", 50000);
    await disburse(w, a.id, "r-1");
    const b = await toApproved(w, "R-2", 60000);
    await disburse(w, b.id, "r-2");
    expect((await repay(a.id, "UTR-REC-0001")).status).toBe(201);
    return { a, b };
  }

  const upload = (token: string, csv: string, name = "statement.csv") =>
    request(app).post("/reconciliation/statements").set(as(token)).send({ name, csv });

  it("marks the demo statement's lines as matched or unmatched", async () => {
    await threeCashEntries();
    const sample = await request(app).get("/reconciliation/sample-statement").set(as(w.tokens.ops));
    expect(sample.status).toBe(200);
    expect(sample.text.split("\n")[0]).toBe("date,reference,description,debit,credit");

    const up = await upload(w.tokens.ops, sample.text);
    expect(up.status).toBe(201);
    const detail = await request(app).get(`/reconciliation/statements/${up.body._id}`).set(as(w.tokens.finance));
    expect(detail.status).toBe(200);
    // three cash entries: the first matches, the second is ₹10 short at the bank, the third is missing; plus one bank charge
    expect(detail.body.summary).toEqual({ lines: 3, matched: 1, unmatched: 2, unmatchedLedger: 2 });
    const byRef = detail.body.lines.find((l: any) => l.status === "MATCHED");
    expect(byRef.method).toBe("REFERENCE");
    const short = detail.body.lines.find((l: any) => /amount differs/.test(l.note ?? ""));
    expect(short).toBeTruthy();
    const charge = detail.body.lines.find((l: any) => /maintenance/.test(l.description));
    expect(charge.note).toMatch(/No ledger entry/);
    expect(detail.body.unmatchedLedger.map((t: any) => t.invoiceNumber).sort()).toEqual(["R-1", "R-2"]);

    const list = await request(app).get("/reconciliation/statements").set(as(w.tokens.ops));
    expect(list.body[0]).toMatchObject({ matched: 1, unmatched: 2 });
  });

  it("matches by reference, and by amount and date when the reference is missing", async () => {
    const { a, b } = await threeCashEntries();
    const txs = await LedgerEntry.find({ account: "LENDER_POOL" }).lean();
    const day = new Date().toISOString().slice(0, 10);
    const pay1 = txs.find((t) => String(t.invoiceId) === a.id && t.credit > 0)!;
    const rep1 = txs.find((t) => String(t.invoiceId) === a.id && t.debit > 0)!;
    const pay2 = txs.find((t) => String(t.invoiceId) === b.id)!;
    const csv = [
      "date,reference,description,debit,credit",
      `${day},${pay1.reference!.toLowerCase()},"NEFT, payout",${(pay1.credit / 100).toFixed(2)},`,
      `${day},,Buyer repayment,,${(rep1.debit / 100).toFixed(2)}`,
      `${day},LCPAY-WRONG,Payout with a wrong reference,${(pay2.credit / 100).toFixed(2)},`,
    ].join("\r\n");
    const up = await upload(w.tokens.ops, csv);
    expect(up.status).toBe(201);
    const detail = (await request(app).get(`/reconciliation/statements/${up.body._id}`).set(as(w.tokens.ops))).body;
    expect(detail.summary).toMatchObject({ lines: 3, matched: 3, unmatched: 0, unmatchedLedger: 0 });
    expect(detail.lines.map((l: any) => l.method)).toEqual(["REFERENCE", "AMOUNT_AND_DATE", "AMOUNT_AND_DATE"]);
  });

  it("does not match one ledger entry twice", async () => {
    const { a } = await threeCashEntries();
    const pay = (await LedgerEntry.findOne({ account: "LENDER_POOL", invoiceId: a.id, credit: { $gt: 0 } }).lean())!;
    const day = new Date().toISOString().slice(0, 10);
    const line = `${day},${pay.reference},NEFT payout,${(pay.credit / 100).toFixed(2)},`;
    const first = await upload(w.tokens.ops, `date,reference,description,debit,credit\n${line}`, "one.csv");
    expect(first.status).toBe(201);
    const second = await upload(w.tokens.ops, `date,reference,description,debit,credit\n${line}\n${day},OTHER1,Something else,1.00,`, "two.csv");
    const detail = (await request(app).get(`/reconciliation/statements/${second.body._id}`).set(as(w.tokens.ops))).body;
    expect(detail.summary.matched).toBe(0);
    expect(detail.summary.unmatched).toBe(2);
  });

  it("refuses bad files, repeats and the wrong people", async () => {
    await threeCashEntries();
    const head = "date,reference,description,debit,credit";
    expect((await upload(w.tokens.ops, "a,b,c\n1,2,3")).body.error).toMatch(/first row/);
    expect((await upload(w.tokens.ops, `${head}\n2026-11-01,X,both,5.00,5.00`)).body.error).toMatch(/exactly one/);
    expect((await upload(w.tokens.ops, `${head}\n01/11/2026,X,bad date,5.00,`)).body.error).toMatch(/date/);
    expect((await upload(w.tokens.ops, `${head}\n2026-11-01,X,bad amount,abc,`)).body.error).toMatch(/amount/);
    expect((await upload(w.tokens.ops, head)).body.error).toMatch(/no lines/);

    const ok = `${head}\n2026-11-01,X1,Something,5.00,`;
    expect((await upload(w.tokens.ops, ok)).status).toBe(201);
    const dup = await upload(w.tokens.ops, ok, "again.csv");
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe("DUPLICATE_STATEMENT");

    expect((await upload(w.tokens.finance, `${head}\n2026-11-02,X2,Something,5.00,`)).status).toBe(403);
    expect((await upload(w.tokens.supplier, `${head}\n2026-11-02,X2,Something,5.00,`)).status).toBe(403);
    expect((await request(app).get("/reconciliation/statements").set(as(w.tokens.supplier))).status).toBe(403);
    expect((await request(app).get("/reconciliation/sample-statement").set(as(w.tokens.finance))).status).toBe(403);
  });
});
