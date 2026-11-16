import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { app, as, disburse, newInvoice, resetDb, seedWorld, startDb, stopDb, toApproved } from "./helpers";
import { Disbursement, Invoice, LedgerEntry, RuleEvaluation, RuleSet, Program } from "../src/models";
import { trialBalance } from "../src/modules/ledger/repository";
import { evaluate } from "../src/modules/rules-engine/evaluator";
import { hooks } from "../src/modules/disbursement/routes";

let w: Awaited<ReturnType<typeof seedWorld>>;

beforeAll(startDb);
afterAll(stopDb);
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
});

describe("acceptance", () => {
  it("a supplier cannot see another supplier's invoices", async () => {
    const id = (await newInvoice(w, "INV-1")).body._id;
    const own = await request(app).get("/invoices").set(as(w.tokens.supplier));
    expect(own.body.items).toHaveLength(1);
    const other = await request(app).get("/invoices").set(as(w.tokens.supplier2));
    expect(other.body.items).toHaveLength(0);
    const direct = await request(app).get(`/invoices/${id}`).set(as(w.tokens.supplier2));
    expect(direct.status).toBe(403);
    const submit = await request(app).post(`/invoices/${id}/submit`).set(as(w.tokens.supplier2));
    expect(submit.status).toBe(403);
  });

  it("maker-checker: recommender cannot approve, rule creator cannot publish", async () => {
    const id = (await newInvoice(w, "INV-2")).body._id;
    await request(app).post(`/invoices/${id}/submit`).set(as(w.tokens.supplier));
    await request(app).post(`/invoices/${id}/confirm`).set(as(w.tokens.buyer));
    await request(app).post(`/invoices/${id}/financing-requests`).set(as(w.tokens.supplier)).send({});
    await Invoice.updateOne({ _id: id }, { recommendedBy: w.users.approver._id, recommendation: "APPROVE" });
    const self = await request(app).post(`/approvals/${id}/decision`).set(as(w.tokens.approver)).send({ decision: "APPROVE", remarks: "self" });
    expect(self.status).toBe(403);
    expect(self.body.code).toBe("MAKER_CHECKER");

    const rs = await request(app).post("/rule-sets").set(as(w.tokens.risk1)).send({ rules: [], pricing: (await RuleSet.findOne().lean())?.pricing ?? {} });
    expect(rs.status).toBe(201);
    const own = await request(app).post(`/rule-sets/${rs.body._id}/publish`).set(as(w.tokens.risk1));
    expect(own.status).toBe(403);
    const other = await request(app).post(`/rule-sets/${rs.body._id}/publish`).set(as(w.tokens.risk2));
    expect(other.status).toBe(200);
  });

  it("same idempotency key never pays twice", async () => {
    const { id } = await toApproved(w, "INV-3");
    const init = await request(app).post("/disbursements").set(as(w.tokens.finance)).send({ invoiceId: id });
    expect(init.status).toBe(201);
    const url = `/disbursements/${init.body.disbursement._id}/authorise`;
    const a = await request(app).post(url).set(as(w.tokens.finance2)).set("Idempotency-Key", "k1");
    const b = await request(app).post(url).set(as(w.tokens.finance2)).set("Idempotency-Key", "k1");
    expect(a.status).toBe(201);
    expect(b.status).toBe(200);
    expect(b.body.disbursement._id).toBe(a.body.disbursement._id);
    expect(await Disbursement.countDocuments()).toBe(1);
    const c = await request(app).post(url).set(as(w.tokens.finance2)).set("Idempotency-Key", "k2");
    expect(c.status).toBe(409);
    expect(await LedgerEntry.countDocuments({ memo: "disbursement" })).toBe(4);
  });

  it("parallel requests with one key still pay once", async () => {
    const { id } = await toApproved(w, "INV-3B");
    const init = await request(app).post("/disbursements").set(as(w.tokens.finance)).send({ invoiceId: id });
    const url = `/disbursements/${init.body.disbursement._id}/authorise`;
    const calls = await Promise.all([1, 2, 3].map(() =>
      request(app).post(url).set(as(w.tokens.finance2)).set("Idempotency-Key", "same")));
    expect(calls.every((c) => [200, 201].includes(c.status))).toBe(true);
    expect(await Disbursement.countDocuments({ status: "SUCCESS" })).toBe(1);
    expect(await LedgerEntry.countDocuments({ memo: "disbursement" })).toBe(4);
  });

  it("every ledger transaction balances", async () => {
    const { id } = await toApproved(w, "INV-4");
    await disburse(w, id, "k");
    const dues = await request(app).get(`/repayments/dues/${id}`).set(as(w.tokens.buyer));
    const rep = await request(app).post("/repayments").set(as(w.tokens.buyer)).send({ invoiceId: id, amount: dues.body.principal, utr: "UTR123456" });
    expect(rep.status).toBe(201);
    expect(rep.body.invoiceStatus).toBe("REPAID");
    const t = await trialBalance();
    expect(t.debit).toBe(t.credit);
    const txs = await LedgerEntry.aggregate([{ $group: { _id: "$txId", d: { $sum: "$debit" }, c: { $sum: "$credit" } } }]);
    expect(txs.length).toBeGreaterThan(1);
    for (const tx of txs) expect(tx.d).toBe(tx.c);
    const prog = await Program.findById(w.program._id);
    expect(prog!.outstanding).toBe(0);
  });

  it("rerunning an invoice against its stored rule version gives the same decision", async () => {
    const { id } = await toApproved(w, "INV-5");
    const ev: any = await RuleEvaluation.findOne({ invoiceId: id }).lean();
    // publish a stricter version afterwards
    const v1: any = await RuleSet.findOne({ version: ev.ruleSetVersion }).lean();
    const strict = await request(app).post("/rule-sets").set(as(w.tokens.risk1)).send({ rules: [], pricing: v1.pricing });
    await request(app).post(`/rule-sets/${strict.body._id}/publish`).set(as(w.tokens.risk2));
    const again = evaluate(v1.rules, v1.pricing, ev.facts);
    expect(again).toEqual(ev.result);
    const sim = await request(app).post(`/rule-sets/${strict.body._id}/simulate`).set(as(w.tokens.risk1));
    expect(sim.body.changed).toBe(1);
  });

  it("concurrent financing requests cannot exceed the program limit", async () => {
    // limit 100000, each invoice 70000 finances 56000: only one fits
    const ids: string[] = [];
    for (const n of ["C1", "C2"]) {
      const id = (await newInvoice(w, n, 70000)).body._id;
      await request(app).post(`/invoices/${id}/submit`).set(as(w.tokens.supplier));
      await request(app).post(`/invoices/${id}/confirm`).set(as(w.tokens.buyer));
      ids.push(id);
    }
    const res = await Promise.all(ids.map((id) => request(app).post(`/invoices/${id}/financing-requests`).set(as(w.tokens.supplier)).send({})));
    const codes = res.map((r) => r.status).sort();
    expect(codes).toEqual([200, 409]);
    const p = await Program.findById(w.program._id);
    expect(p!.outstanding).toBeLessThanOrEqual(p!.sanctioned);
    expect(p!.outstanding).toBe(56000 * 100);
  });

  it("a failure after the ledger write rolls the authorisation back", async () => {
    const { id } = await toApproved(w, "INV-6");
    const init = await request(app).post("/disbursements").set(as(w.tokens.finance)).send({ invoiceId: id });
    const url = `/disbursements/${init.body.disbursement._id}/authorise`;
    hooks.afterLedger = () => { throw new Error("boom"); };
    const r = await request(app).post(url).set(as(w.tokens.finance2)).set("Idempotency-Key", "rb");
    hooks.afterLedger = undefined;
    expect(r.status).toBe(500);
    expect((await Disbursement.findById(init.body.disbursement._id))!.status).toBe("PENDING_AUTH");
    expect(await LedgerEntry.countDocuments()).toBe(0);
    expect((await Invoice.findById(id))!.status).toBe("APPROVED");
    const retry = await request(app).post(url).set(as(w.tokens.finance2)).set("Idempotency-Key", "rb");
    expect(retry.status).toBe(201);
  });

  it("approver cannot initiate a payout for their own approval (segregation of duties)", async () => {
    const { id } = await toApproved(w, "INV-7");
    const r = await request(app).post("/disbursements").set(as(w.tokens.approver)).send({ invoiceId: id });
    expect(r.status).toBe(403);
  });

  it("whoever initiates a payout cannot authorise it", async () => {
    const { id } = await toApproved(w, "INV-8");
    const init = await request(app).post("/disbursements").set(as(w.tokens.finance)).send({ invoiceId: id });
    const url = `/disbursements/${init.body.disbursement._id}/authorise`;
    const self = await request(app).post(url).set(as(w.tokens.finance)).set("Idempotency-Key", "self");
    expect(self.status).toBe(403);
    expect(self.body.code ?? self.body.reason ?? JSON.stringify(self.body)).toContain("DUAL_CONTROL");
    expect((await Invoice.findById(id))!.status).toBe("APPROVED");
    const other = await request(app).post(url).set(as(w.tokens.finance2)).set("Idempotency-Key", "other");
    expect(other.status).toBe(201);
  });

  it("operations and accounts cannot move money", async () => {
    const { id } = await toApproved(w, "INV-9");
    for (const t of [w.tokens.ops, w.tokens.accounts]) {
      const r = await request(app).post("/disbursements").set(as(t)).send({ invoiceId: id });
      expect(r.status).toBe(403);
    }
  });

  it("two finance users authorising at once release the payout once", async () => {
    const { id } = await toApproved(w, "INV-10");
    const init = await request(app).post("/disbursements").set(as(w.tokens.finance)).send({ invoiceId: id });
    const url = `/disbursements/${init.body.disbursement._id}/authorise`;
    const calls = await Promise.all([
      request(app).post(url).set(as(w.tokens.finance2)).set("Idempotency-Key", "a"),
      request(app).post(url).set(as(w.tokens.finance3)).set("Idempotency-Key", "b"),
    ]);
    expect(calls.map((c) => c.status).sort()).toEqual([201, 409]);
    const loser = calls.find((c) => c.status === 409)!;
    expect(loser.body.code).toBe("ALREADY_AUTHORISED");
    expect(await LedgerEntry.countDocuments({ memo: "disbursement" })).toBe(4);
    expect(await Disbursement.countDocuments({ status: "SUCCESS" })).toBe(1);
    expect((await Invoice.findById(id))!.status).toBe("DISBURSED");
  });

  it("queuing the same invoice twice never makes two payouts", async () => {
    const { id } = await toApproved(w, "INV-11");
    const send = (extra: Record<string, string> = {}) =>
      request(app).post("/disbursements").set(as(w.tokens.finance)).set(extra).send({ invoiceId: id });
    const first = await send();
    expect(first.status).toBe(201);
    expect((await send()).status).toBe(409);
    expect((await send({ "Idempotency-Key": "same" })).status).toBe(409);
    expect((await send({ "Idempotency-Key": "same" })).status).toBe(409);

    const { id: id2 } = await toApproved(w, "INV-12");
    const race = await Promise.all([1, 2, 3, 4].map(() =>
      request(app).post("/disbursements").set(as(w.tokens.finance)).send({ invoiceId: id2 })));
    expect(race.map((r) => r.status).sort()).toEqual([201, 409, 409, 409]);
    expect(await Disbursement.countDocuments({ invoiceId: id2 })).toBe(1);
  });

  it("replaying a released payout with the same key returns the original result", async () => {
    const { id } = await toApproved(w, "INV-13");
    const init = await request(app).post("/disbursements").set(as(w.tokens.finance)).send({ invoiceId: id });
    const url = `/disbursements/${init.body.disbursement._id}/authorise`;
    const first = await request(app).post(url).set(as(w.tokens.finance2)).set("Idempotency-Key", "keep");
    const replay = await request(app).post(url).set(as(w.tokens.finance2)).set("Idempotency-Key", "keep");
    expect(first.status).toBe(201);
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual(first.body);

    // someone else, with their own key, is told it is already done
    const other = await request(app).post(url).set(as(w.tokens.finance3)).set("Idempotency-Key", "theirs");
    expect(other.status).toBe(409);
    expect(other.body.code).toBe("ALREADY_AUTHORISED");

    // someone else reusing the first caller's key does not get that caller's response
    const stolen = await request(app).post(url).set(as(w.tokens.finance3)).set("Idempotency-Key", "keep");
    expect(stolen.status).toBe(409);
    expect(stolen.body.code).toBe("IDEMPOTENCY_KEY_REUSED");
    expect(await LedgerEntry.countDocuments({ memo: "disbursement" })).toBe(4);
  });

  it("a failed payout can be queued again, a live one cannot", async () => {
    const { id } = await toApproved(w, "INV-14");
    const first = await request(app).post("/disbursements").set(as(w.tokens.finance)).send({ invoiceId: id });
    expect((await request(app).post("/disbursements").set(as(w.tokens.finance)).send({ invoiceId: id })).status).toBe(409);
    await Disbursement.updateOne({ _id: first.body.disbursement._id }, { $set: { status: "FAILED" } });
    const again = await request(app).post("/disbursements").set(as(w.tokens.finance)).send({ invoiceId: id });
    expect(again.status).toBe(201);
    expect(again.body.disbursement._id).not.toBe(first.body.disbursement._id);
    expect((await request(app).post("/disbursements").set(as(w.tokens.finance)).send({ invoiceId: id })).status).toBe(409);
    expect(await Disbursement.countDocuments({ invoiceId: id })).toBe(2);
  });

  it("only admins can read the role table", async () => {
    expect((await request(app).get("/access/roles").set(as(w.tokens.supplier))).status).toBe(403);
    const r = await request(app).get("/access/roles").set(as(w.tokens.admin));
    expect(r.status).toBe(200);
    expect(r.body.ACCOUNTS).toContain("period:close");
  });

  it("a buyer cannot see a supplier's draft", async () => {
    const { body } = await newInvoice(w, "INV-DRAFT");
    const list = await request(app).get("/invoices").set(as(w.tokens.buyer));
    expect(list.body.items.map((i: any) => i.number)).not.toContain("INV-DRAFT");
    const one = await request(app).get(`/invoices/${body._id}`).set(as(w.tokens.buyer));
    expect(one.status).toBe(404);
    await request(app).post(`/invoices/${body._id}/submit`).set(as(w.tokens.supplier));
    const after = await request(app).get("/invoices").set(as(w.tokens.buyer));
    expect(after.body.items.map((i: any) => i.number)).toContain("INV-DRAFT");
  });

  it("login returns the permission list for the role", async () => {
    const r = await request(app).post("/auth/login").send({ email: "accounts@t.com", password: "Passw0rd!x" });
    expect(r.body.permissions).toEqual(expect.arrayContaining(["journal:post", "period:close"]));
    expect(r.body.permissions).not.toContain("disbursement:authorise");
  });
});
