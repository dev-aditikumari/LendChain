import { Entity, FollowUp, Invoice } from "../../models";
import { move } from "../invoices/service";

export async function markOverdue(now = new Date()): Promise<number> {
  const due = await Invoice.find({ status: "DISBURSED", dueDate: { $lt: now } });
  for (const inv of due) await move(inv, "OVERDUE", undefined);
  return due.length;
}

export const BUCKETS = ["0-30", "31-60", "61-90", "90+"] as const;
export type Bucket = (typeof BUCKETS)[number];

export const bucketFor = (daysOverdue: number): Bucket =>
  daysOverdue <= 30 ? "0-30" : daysOverdue <= 60 ? "31-60" : daysOverdue <= 90 ? "61-90" : "90+";

// every overdue invoice with its age, the buyer's contact and the latest follow-up
export async function overdueRows(now = new Date()) {
  const invoices = await Invoice.find({ status: "OVERDUE" }).sort({ dueDate: 1 }).lean();
  const buyers = new Map((await Entity.find({ _id: { $in: invoices.map((i) => i.buyerId) } }).lean()).map((e) => [String(e._id), e]));
  const follow = await FollowUp.find({ invoiceId: { $in: invoices.map((i) => i._id) } }).sort({ createdAt: -1 }).lean();
  return invoices.map((i) => {
    const days = Math.max(0, Math.floor((now.getTime() - new Date(i.dueDate).getTime()) / 86400000));
    const mine = follow.filter((f) => String(f.invoiceId) === String(i._id));
    const buyer: any = buyers.get(String(i.buyerId));
    return {
      id: String(i._id),
      number: i.number,
      buyer: buyer?.legalName ?? "Unknown buyer",
      contact: buyer?.contactName ?? null,
      contactEmail: buyer?.contactEmail ?? null,
      amount: i.financedAmount ?? 0,
      dueDate: i.dueDate,
      daysOverdue: days,
      bucket: bucketFor(days),
      lastFollowUp: (mine[0] as any)?.createdAt ?? null,
      openFollowUps: mine.filter((f) => f.status === "OPEN").length,
    };
  });
}

export async function ageing(now = new Date()) {
  const rows = await overdueRows(now);
  const buckets = Object.fromEntries(BUCKETS.map((b) => [b, { amount: 0, count: 0 }])) as Record<Bucket, { amount: number; count: number }>;
  for (const r of rows) {
    buckets[r.bucket].amount += r.amount;
    buckets[r.bucket].count += 1;
  }
  return { buckets, rows };
}

