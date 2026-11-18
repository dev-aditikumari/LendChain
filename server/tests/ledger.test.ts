import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { app, as, disburse, resetDb, seedWorld, startDb, stopDb, toApproved } from "./helpers";
import { AccrualRun, Disbursement, LedgerEntry } from "../src/models";
import { post, trialBalance } from "../src/modules/ledger/repository";
import { runAccruals, utcDay } from "../src/modules/ledger/accruals";

let w: Awaited<ReturnType<typeof seedWorld>>;

beforeAll(startDb);
afterAll(stopDb);
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
});

const DAY = 86400000;
const today = () => utcDay(new Date());
const addDays = (day: string, n: number) => utcDay(new Date(new Date(`${day}T00:00:00.000Z`).getTime() + n * DAY));
const later = () => new Date(Date.now() + 400 * DAY);

async function disbursed(number = "L-1", rupees = 50000) {
  const { id } = await toApproved(w, number, rupees);
  const { authorise } = await disburse(w, id, `key-${number}`);
  expect(authorise.status).toBe(201);
  const d = await Disbursement.findOne({ invoiceId: id }).lean();
  return { id, d: d! };
}

async function repay(id: string, utr: string) {
  const dues = await request(app).get(`/repayments/dues/${id}`).set(as(w.tokens.buyer));
  const r = await request(app).post("/repayments").set(as(w.tokens.buyer)).send({ invoiceId: id, amount: dues.body.principal, utr });
  expect(r.status).toBe(201);
}

// a balanced entry dated in an earlier month, to give a period something to close
const lastMonth = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() - 1, 15, 12));
};
const key = (d: Date) => d.toISOString().slice(0, 7);

describe("ledger", () => {
  it("cannot be edited or deleted", async () => {
    await disbursed();
    const row = await LedgerEntry.findOne();
    await expect(LedgerEntry.updateOne({ _id: row!._id }, { debit: 1 })).rejects.toThrow(/cannot be changed/);
    await expect(LedgerEntry.deleteMany({})).rejects.toThrow(/cannot be changed/);
    await expect(LedgerEntry.findOneAndUpdate({ _id: row!._id }, { credit: 1 })).rejects.toThrow(/cannot be changed/);
    row!.debit = 5;
    await expect(row!.save()).rejects.toThrow(/cannot be changed/);
    expect(await LedgerEntry.countDocuments({ debit: 5 })).toBe(0);
  });

  it("trial balance has no difference after the full invoice flow, and unearned interest clears on repayment", async () => {
    const { id, d } = await disbursed();
    let tb = await request(app).get("/ledger/trial-balance").set(as(w.tokens.accounts));
    expect(tb.status).toBe(200);
    expect(tb.body.difference).toBe(0);
    expect(tb.body.unbalanced).toEqual([]);
    const unearned = tb.body.accounts.find((a: any) => a.account === "UNEARNED_INTEREST");
    expect(unearned.credit).toBe(d.upfrontInterest);
    expect(tb.body.accounts.find((a: any) => a.account === "INTEREST_INCOME")).toBeUndefined();

    await repay(id, "UTR-100001");
    tb = await request(app).get("/ledger/trial-balance").set(as(w.tokens.accounts));
    expect(tb.body.difference).toBe(0);
    const un = tb.body.accounts.find((a: any) => a.account === "UNEARNED_INTEREST");
    const income = tb.body.accounts.find((a: any) => a.account === "INTEREST_INCOME");
    expect(un.balance).toBe(0);
    expect(income.credit).toBe(d.upfrontInterest);
  });

  it("running accruals twice for a date posts once, and the days add up to the interest", async () => {
    const { d } = await disbursed();
    const day0 = today();
    const entriesBefore = await LedgerEntry.countDocuments();

    const first = await runAccruals(day0, w.users.accounts.id, "MANUAL", later());
    expect(first).toMatchObject({ alreadyRun: false, count: 1 });
    const afterFirst = await LedgerEntry.countDocuments();
    expect(afterFirst).toBe(entriesBefore + 2);

    const second = await runAccruals(day0, w.users.accounts.id, "MANUAL", later());
    expect(second).toMatchObject({ alreadyRun: true, count: 1, amount: first.amount });
    expect(await LedgerEntry.countDocuments()).toBe(afterFirst);
    expect(await AccrualRun.countDocuments({ date: day0 })).toBe(1);

    // two requests at once still post once
    const [a, b] = await Promise.all([
      runAccruals(addDays(day0, 1), undefined, "MANUAL", later()),
      runAccruals(addDays(day0, 1), undefined, "MANUAL", later()),
    ]);
    expect([a.alreadyRun, b.alreadyRun].sort()).toEqual([false, true]);

    for (let k = 2; k < d.accrualDays! + 3; k++) await runAccruals(addDays(day0, k), undefined, "MANUAL", later());
    const after = await Disbursement.findById(d._id).lean();
    expect(after!.accruedInterest).toBe(d.upfrontInterest);
    const tb = await trialBalance();
    expect(tb.difference).toBe(0);
    expect(tb.accounts.find((x) => x.account === "UNEARNED_INTEREST")!.balance).toBe(0);
    expect(tb.accounts.find((x) => x.account === "INTEREST_INCOME")!.credit).toBe(d.upfrontInterest);
  });

  it("accruals are limited to finished days and to accountants", async () => {
    await disbursed();
    const run = (token: string, date: string) => request(app).post("/ledger/accruals/run").set(as(token)).send({ date });
    expect((await run(w.tokens.accounts, today())).status).toBe(400);
    expect((await run(w.tokens.accounts, "yesterday")).status).toBe(400);
    expect((await run(w.tokens.finance, addDays(today(), -1))).status).toBe(403);
    const ok = await run(w.tokens.accounts, addDays(today(), -1));
    expect(ok.status).toBe(201);
    expect(ok.body.count).toBe(0);
    expect((await run(w.tokens.accounts, addDays(today(), -1))).body.alreadyRun).toBe(true);
    const list = await request(app).get("/ledger/accruals").set(as(w.tokens.accounts));
    expect(list.body.runs).toHaveLength(1);
  });

  it("closing a period needs a second person, and a closed period refuses posting", async () => {
    const when = lastMonth();
    const k = key(when);
    await post("seed-tx", undefined, [{ account: "LENDER_POOL", debit: 1000, credit: 0 }, { account: "FEE_INCOME", debit: 0, credit: 1000 }], "test", undefined, { postedOn: when });

    expect((await request(app).post(`/ledger/periods/${key(new Date())}/request-close`).set(as(w.tokens.accounts))).status).toBe(400);
    expect((await request(app).post(`/ledger/periods/${k}/request-close`).set(as(w.tokens.finance))).status).toBe(403);

    const req1 = await request(app).post(`/ledger/periods/${k}/request-close`).set(as(w.tokens.accounts));
    expect(req1.status).toBe(201);
    expect((await request(app).post(`/ledger/periods/${k}/request-close`).set(as(w.tokens.accounts2))).status).toBe(409);

    const own = await request(app).post(`/ledger/periods/${k}/sign-off`).set(as(w.tokens.accounts));
    expect(own.status).toBe(403);
    expect(own.body.code).toBe("MAKER_CHECKER");

    // still open while waiting for the sign-off
    await post("open-tx", undefined, [{ account: "LENDER_POOL", debit: 5, credit: 0 }, { account: "FEE_INCOME", debit: 0, credit: 5 }], "test", undefined, { postedOn: when });

    const signed = await request(app).post(`/ledger/periods/${k}/sign-off`).set(as(w.tokens.accounts2));
    expect(signed.status).toBe(200);

    await expect(post("late-tx", undefined, [{ account: "LENDER_POOL", debit: 5, credit: 0 }, { account: "FEE_INCOME", debit: 0, credit: 5 }], "test", undefined, { postedOn: when })).rejects.toMatchObject({ code: "PERIOD_CLOSED", status: 409 });
    const blocked = await request(app).post("/ledger/accruals/run").set(as(w.tokens.accounts)).send({ date: utcDay(when) });
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe("PERIOD_CLOSED");

    const list = await request(app).get("/ledger/periods").set(as(w.tokens.accounts));
    expect(list.body.find((p: any) => p.key === k)).toMatchObject({ status: "CLOSED", closedByName: "accounts2", requestedByName: "accounts" });
    // a period that is closed stays closed
    expect((await request(app).post(`/ledger/periods/${k}/sign-off`).set(as(w.tokens.accounts2))).status).toBe(409);
  });

  it("corrects a closed period with a reversal in the open one", async () => {
    const when = lastMonth();
    await post("old-tx", undefined, [{ account: "LENDER_POOL", debit: 700, credit: 0 }, { account: "FEE_INCOME", debit: 0, credit: 700 }], "test", undefined, { postedOn: when });
    await request(app).post(`/ledger/periods/${key(when)}/request-close`).set(as(w.tokens.accounts));
    await request(app).post(`/ledger/periods/${key(when)}/sign-off`).set(as(w.tokens.accounts2));

    const short = await request(app).post("/ledger/transactions/old-tx/reverse").set(as(w.tokens.accounts)).send({ reason: "no" });
    expect(short.status).toBe(400);
    expect((await request(app).post("/ledger/transactions/old-tx/reverse").set(as(w.tokens.ops)).send({ reason: "wrong account" })).status).toBe(403);

    const ok = await request(app).post("/ledger/transactions/old-tx/reverse").set(as(w.tokens.accounts)).send({ reason: "posted to the wrong account" });
    expect(ok.status).toBe(201);
    const rev = await LedgerEntry.find({ txId: "old-tx-rev" }).lean();
    expect(rev).toHaveLength(2);
    expect(rev.every((r) => key(r.postedOn) === key(new Date()))).toBe(true);
    expect(rev.find((r) => r.account === "LENDER_POOL")!.credit).toBe(700);
    expect((await trialBalance()).difference).toBe(0);

    expect((await request(app).post("/ledger/transactions/old-tx/reverse").set(as(w.tokens.accounts)).send({ reason: "again please" })).status).toBe(409);
    expect((await request(app).post("/ledger/transactions/old-tx-rev/reverse").set(as(w.tokens.accounts)).send({ reason: "undo the undo" })).status).toBe(409);
    expect((await request(app).post("/ledger/transactions/nope/reverse").set(as(w.tokens.accounts)).send({ reason: "does not exist" })).status).toBe(404);
  });

  it("reversing an accrual makes that interest unearned again", async () => {
    const { d } = await disbursed();
    await runAccruals(today(), undefined, "MANUAL", later());
    const accrued = (await Disbursement.findById(d._id).lean())!.accruedInterest!;
    expect(accrued).toBeGreaterThan(0);
    const r = await request(app).post(`/ledger/transactions/accrual-${today()}-${d._id}/reverse`).set(as(w.tokens.accounts)).send({ reason: "run on the wrong date" });
    expect(r.status).toBe(201);
    expect((await Disbursement.findById(d._id).lean())!.accruedInterest).toBe(0);
    expect((await trialBalance()).difference).toBe(0);
  });

  it("lists entries with filters and paging for people who may read the ledger", async () => {
    await disbursed();
    const all = await request(app).get("/ledger/entries?limit=2").set(as(w.tokens.ops));
    expect(all.status).toBe(200);
    expect(all.body.items).toHaveLength(2);
    expect(all.body.total).toBe(4);
    expect(all.body.totals.difference).toBe(0);
    const one = await request(app).get("/ledger/entries?account=FEE_INCOME").set(as(w.tokens.ops));
    expect(one.body.items).toHaveLength(1);
    expect(one.body.items[0].invoiceNumber).toBe("L-1");
    expect((await request(app).get("/ledger/entries").set(as(w.tokens.supplier))).status).toBe(403);
    expect((await request(app).get("/ledger/entries?account=NOPE").set(as(w.tokens.ops))).status).toBe(400);
  });
});
