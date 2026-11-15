import { ClientSession } from "mongoose";
import { LedgerEntry } from "../../models";
import { Line, assertBalanced } from "./posting";

// insert only: no update or delete is exposed on purpose
export async function post(txId: string, invoiceId: unknown, lines: Line[], memo: string, session?: ClientSession) {
  assertBalanced(lines);
  await LedgerEntry.insertMany(lines.map((l) => ({ ...l, txId, invoiceId, memo })), { session });
}

export function entries(filter: Record<string, unknown> = {}) {
  return LedgerEntry.find(filter).sort({ createdAt: 1 }).lean();
}

export async function trialBalance(): Promise<{ debit: number; credit: number }> {
  const [r] = await LedgerEntry.aggregate([{ $group: { _id: null, debit: { $sum: "$debit" }, credit: { $sum: "$credit" } } }]);
  return { debit: r?.debit ?? 0, credit: r?.credit ?? 0 };
}

export async function reverse(txId: string, session?: ClientSession) {
  const rows = await LedgerEntry.find({ txId }).session(session ?? null).lean();
  const lines = rows.map((r) => ({ account: r.account as Line["account"], debit: r.credit, credit: r.debit }));
  await post(`${txId}-rev`, rows[0]?.invoiceId, lines, `reversal of ${txId}`, session);
}
