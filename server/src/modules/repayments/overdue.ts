import { Invoice, InvoiceEvent } from "../../models";
import { move } from "../invoices/service";

export async function markOverdue(now = new Date()): Promise<number> {
  const due = await Invoice.find({ status: "DISBURSED", dueDate: { $lt: now } });
  for (const inv of due) await move(inv, "OVERDUE", undefined);
  return due.length;
}

export async function ageing(now = new Date()) {
  const rows = await Invoice.find({ status: "OVERDUE" }).lean();
  const buckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  for (const r of rows) {
    const d = Math.floor((now.getTime() - new Date(r.dueDate).getTime()) / 86400000);
    const k = d <= 30 ? "0-30" : d <= 60 ? "31-60" : d <= 90 ? "61-90" : "90+";
    buckets[k] += r.financedAmount ?? 0;
  }
  return buckets;
}
