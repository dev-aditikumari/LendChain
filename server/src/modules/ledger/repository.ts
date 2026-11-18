import { ClientSession } from "mongoose";
import { LedgerEntry, Reversal } from "../../models";
import { conflict, notFound } from "../../shared/errors";
import { Line, assertBalanced, ACCOUNTS } from "./posting";
import { assertOpen } from "./periods";

export interface PostMeta {
  reference?: string;
  postedOn?: Date;
  disbursementId?: unknown;
  reverses?: string;
}

// insert only: no update or delete is exposed on purpose.
// A closed period refuses new entries; fix it with a reversal in the open period.
export async function post(txId: string, invoiceId: unknown, lines: Line[], memo: string, session?: ClientSession, meta: PostMeta = {}) {
  assertBalanced(lines);
  const postedOn = meta.postedOn ?? new Date();
  await assertOpen(postedOn, session);
  await LedgerEntry.insertMany(
    lines.map((l) => ({ ...l, txId, invoiceId, memo, postedOn, reference: meta.reference, disbursementId: meta.disbursementId, reverses: meta.reverses })),
    { session },
  );
}

export function entries(filter: Record<string, unknown> = {}) {
  return LedgerEntry.find(filter).sort({ createdAt: 1 }).lean();
}

// totals per account up to (not including) `before`, plus any transaction whose lines do not balance
export async function trialBalance(before?: Date) {
  const match = before ? { postedOn: { $lt: before } } : {};
  const rows = await LedgerEntry.aggregate([
    { $match: match },
    { $group: { _id: "$account", debit: { $sum: "$debit" }, credit: { $sum: "$credit" } } },
  ]);
  const by = new Map(rows.map((r) => [r._id as string, r]));
  const names = [...ACCOUNTS.filter((a) => by.has(a)), ...rows.map((r) => r._id as string).filter((a) => !(ACCOUNTS as string[]).includes(a))];
  const accounts = names.map((account) => {
    const r = by.get(account)!;
    return { account, debit: r.debit as number, credit: r.credit as number, balance: (r.debit as number) - (r.credit as number) };
  });
  const debit = accounts.reduce((s, a) => s + a.debit, 0);
  const credit = accounts.reduce((s, a) => s + a.credit, 0);
  const txs = await LedgerEntry.aggregate([
    { $match: match },
    { $group: { _id: "$txId", debit: { $sum: "$debit" }, credit: { $sum: "$credit" } } },
    { $match: { $expr: { $ne: ["$debit", "$credit"] } } },
  ]);
  return {
    accounts,
    debit,
    credit,
    difference: debit - credit,
    unbalanced: txs.map((t) => ({ txId: t._id as string, debit: t.debit as number, credit: t.credit as number })),
  };
}

// a reversal swaps debits and credits and is dated now, in whatever period is open
export async function reverse(txId: string, reason: string, by: string, session?: ClientSession) {
  const rows = await LedgerEntry.find({ txId }).session(session ?? null).lean();
  if (rows.length === 0) throw notFound("Transaction");
  if (rows[0].reverses) throw conflict("A reversal cannot be reversed", "ALREADY_REVERSED");
  const reversalTxId = `${txId}-rev`;
  try {
    await Reversal.create([{ txId, reversalTxId, reason, by }], { session });
  } catch (e: any) {
    if (e?.code === 11000) throw conflict("This transaction was already reversed", "ALREADY_REVERSED");
    throw e;
  }
  const lines = rows.map((r) => ({ account: r.account as Line["account"], debit: r.credit, credit: r.debit }));
  await post(reversalTxId, rows[0].invoiceId, lines, `reversal of ${txId}: ${reason}`, session, {
    reverses: txId,
    disbursementId: rows[0].disbursementId,
  });
  return { reversalTxId, rows };
}
