import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { AccrualRun, Disbursement, Invoice, LedgerEntry, Period, Reversal, User } from "../../models";
import { authenticate, check } from "../../middleware/auth";
import { badRequest, conflict, notFound } from "../../shared/errors";
import { audit } from "../../shared/audit";
import { ACCOUNTS } from "./posting";
import { periodEnd, periodKey } from "./periods";
import { reverse, trialBalance } from "./repository";
import { runAccruals, yesterday } from "./accruals";

export const ledgerRouter = Router();
ledgerRouter.use(authenticate);

const nameMap = async (ids: unknown[]) => {
  const users = await User.find({ _id: { $in: ids.filter(Boolean) } }, "name").lean();
  return new Map(users.map((u: any) => [String(u._id), u.name as string]));
};

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-11-17");

ledgerRouter.get("/entries", async (req, res) => {
  check(req, "ledger:read", {});
  const q = z.object({
    account: z.enum(ACCOUNTS as [string, ...string[]]).optional(),
    txId: z.string().optional(),
    invoiceId: z.string().optional(),
    from: day.optional(),
    to: day.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  }).parse(req.query);

  const filter: Record<string, unknown> = {};
  if (q.account) filter.account = q.account;
  if (q.txId) filter.txId = q.txId;
  if (q.invoiceId) filter.invoiceId = q.invoiceId;
  if (q.from || q.to) {
    filter.postedOn = {
      ...(q.from ? { $gte: new Date(`${q.from}T00:00:00.000Z`) } : {}),
      ...(q.to ? { $lte: new Date(`${q.to}T23:59:59.999Z`) } : {}),
    };
  }
  const [rows, total] = await Promise.all([
    LedgerEntry.find(filter).sort({ postedOn: -1, createdAt: -1, _id: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    LedgerEntry.countDocuments(filter),
  ]);
  const invoices = await Invoice.find({ _id: { $in: rows.map((r) => r.invoiceId).filter(Boolean) } }, "number").lean();
  const numbers = new Map(invoices.map((i: any) => [String(i._id), i.number as string]));
  const reversed = new Set((await Reversal.find({ txId: { $in: rows.map((r) => r.txId) } }, "txId").lean()).map((r: any) => r.txId));
  const t = await trialBalance();
  res.json({
    items: rows.map((r) => ({ ...r, invoiceNumber: r.invoiceId ? numbers.get(String(r.invoiceId)) : undefined, reversed: reversed.has(r.txId) })),
    total,
    page: q.page,
    limit: q.limit,
    totals: { debit: t.debit, credit: t.credit, difference: t.difference, unbalanced: t.unbalanced.length },
  });
});

ledgerRouter.get("/trial-balance", async (req, res) => {
  check(req, "ledger:read", {});
  const { asOf } = z.object({ asOf: day.optional() }).parse(req.query);
  const before = asOf ? new Date(new Date(`${asOf}T00:00:00.000Z`).getTime() + 86400000) : undefined;
  res.json({ asOf: asOf ?? null, ...(await trialBalance(before)) });
});

// a correction: swaps debits and credits, dated today in the open period
ledgerRouter.post("/transactions/:txId/reverse", async (req, res) => {
  check(req, "journal:post", {});
  const { reason } = z.object({ reason: z.string().trim().min(5, "Give a reason (at least 5 characters)").max(200) }).parse(req.body);
  const session = await mongoose.startSession();
  let out: { reversalTxId: string } | undefined;
  try {
    await session.withTransaction(async () => {
      const r = await reverse(req.params.txId, reason, req.actor.id, session);
      // an undone accrual makes that interest unearned again, so it is recognised later
      if (req.params.txId.startsWith("accrual-")) {
        const income = r.rows.find((x) => x.account === "INTEREST_INCOME");
        if (income?.disbursementId) {
          await Disbursement.updateOne({ _id: income.disbursementId }, { $inc: { accruedInterest: -income.credit } }, { session });
        }
      }
      out = { reversalTxId: r.reversalTxId };
    });
  } finally {
    await session.endSession();
  }
  await audit(req, "ledger.reverse", req.params.txId, null, { reason, ...out });
  res.status(201).json(out);
});

ledgerRouter.get("/accruals", async (req, res) => {
  check(req, "ledger:read", {});
  const runs = await AccrualRun.find().sort({ date: -1 }).limit(60).lean();
  const who = await nameMap(runs.map((r) => r.runBy));
  const open = await Disbursement.countDocuments({ status: "SUCCESS", upfrontInterest: { $gt: 0 }, $expr: { $lt: ["$accruedInterest", "$upfrontInterest"] } });
  const [unearned] = await LedgerEntry.aggregate([{ $match: { account: "UNEARNED_INTEREST" } }, { $group: { _id: null, debit: { $sum: "$debit" }, credit: { $sum: "$credit" } } }]);
  res.json({
    suggestedDate: yesterday(),
    openPayouts: open,
    unearned: (unearned?.credit ?? 0) - (unearned?.debit ?? 0),
    runs: runs.map((r) => ({ ...r, runByName: r.source === "SCHEDULE" ? "Daily schedule" : who.get(String(r.runBy)) })),
  });
});

ledgerRouter.post("/accruals/run", async (req, res) => {
  check(req, "journal:post", {});
  const { date } = z.object({ date: day }).parse(req.body);
  const r = await runAccruals(date, req.actor.id, "MANUAL");
  if (!r.alreadyRun) await audit(req, "accrual.run", date, null, { count: r.count, amount: r.amount });
  res.status(r.alreadyRun ? 200 : 201).json(r);
});

// ---- period close: one person requests, a different person signs off ----

ledgerRouter.get("/periods", async (req, res) => {
  check(req, "ledger:read", {});
  const monthly = await LedgerEntry.aggregate([
    { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$postedOn" } }, entries: { $sum: 1 }, debit: { $sum: "$debit" }, credit: { $sum: "$credit" } } },
  ]);
  const docs = await Period.find().lean();
  const byKey = new Map(docs.map((p) => [p.key, p]));
  const keys = new Set<string>([periodKey(new Date()), ...monthly.map((m) => m._id as string), ...docs.map((p) => p.key)]);
  const sorted = [...keys].sort();
  // fill the gaps so the list has no missing months
  const all: string[] = [];
  for (let k = sorted[0]; k <= sorted[sorted.length - 1]; ) {
    all.push(k);
    k = periodKey(periodEnd(k));
  }
  const who = await nameMap(docs.flatMap((p) => [p.requestedBy, p.closedBy]));
  const now = new Date();
  const m = new Map(monthly.map((x) => [x._id as string, x]));
  res.json(all.reverse().map((key) => {
    const p = byKey.get(key);
    const row = m.get(key);
    return {
      key,
      status: p?.status ?? "OPEN",
      ended: periodEnd(key) <= now,
      entries: row?.entries ?? 0,
      debit: row?.debit ?? 0,
      credit: row?.credit ?? 0,
      requestedBy: p?.requestedBy,
      requestedByName: p?.requestedBy ? who.get(String(p.requestedBy)) : undefined,
      requestedAt: p?.requestedAt,
      closedByName: p?.closedBy ? who.get(String(p.closedBy)) : undefined,
      closedAt: p?.closedAt,
    };
  }));
});

const validKey = (key: string) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) throw badRequest("Period must look like 2026-10");
  return key;
};

async function readyToClose(key: string) {
  if (periodEnd(key) > new Date()) throw badRequest("A period can only be closed after it has ended", "PERIOD_NOT_ENDED");
  const t = await trialBalance(periodEnd(key));
  if (t.difference !== 0 || t.unbalanced.length > 0) throw conflict("The trial balance does not balance, so the period cannot be closed", "TRIAL_BALANCE_OUT");
  return t;
}

ledgerRouter.post("/periods/:key/request-close", async (req, res) => {
  check(req, "period:close", {});
  const key = validKey(req.params.key);
  if (await Period.exists({ key })) throw conflict("This period already has a close request", "ALREADY_REQUESTED");
  await readyToClose(key);
  try {
    await Period.create({ key, status: "CLOSE_REQUESTED", requestedBy: req.actor.id, requestedAt: new Date() });
  } catch (e: any) {
    if (e?.code === 11000) throw conflict("This period already has a close request", "ALREADY_REQUESTED");
    throw e;
  }
  await audit(req, "period.request-close", key);
  res.status(201).json({ key, status: "CLOSE_REQUESTED" });
});

ledgerRouter.post("/periods/:key/sign-off", async (req, res) => {
  const key = validKey(req.params.key);
  const p = await Period.findOne({ key });
  if (!p) throw notFound("Close request");
  check(req, "period:close", { createdBy: String(p.requestedBy) });
  if (p.status !== "CLOSE_REQUESTED") throw conflict("This period is already closed", "ALREADY_CLOSED");
  const t = await readyToClose(key);
  const closed = await Period.findOneAndUpdate(
    { _id: p._id, status: "CLOSE_REQUESTED" },
    { status: "CLOSED", closedBy: req.actor.id, closedAt: new Date(), snapshot: { debit: t.debit, credit: t.credit, accounts: t.accounts } },
    { returnDocument: "after" },
  );
  if (!closed) throw conflict("This period is already closed", "ALREADY_CLOSED");
  await audit(req, "period.close", key, null, { debit: t.debit, credit: t.credit });
  res.json({ key, status: "CLOSED" });
});
