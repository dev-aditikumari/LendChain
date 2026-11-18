import { ClientSession } from "mongoose";
import { ExceptionItem } from "../../models";

export async function raise(
  e: { kind: "PAYOUT_FAILED" | "WEBHOOK_PROBLEM"; severity?: "HIGH" | "MEDIUM" | "LOW"; title: string; detail?: string; invoiceId?: any; disbursementId?: any },
  session?: ClientSession,
) {
  const [doc] = await ExceptionItem.create([e], { session });
  return doc;
}

// a payout that goes through closes the failure that was waiting on it
export async function resolveForInvoice(invoiceId: any, resolution: string, session?: ClientSession) {
  await ExceptionItem.updateMany(
    { invoiceId, kind: "PAYOUT_FAILED", status: "OPEN" },
    { $set: { status: "RESOLVED", resolution, resolvedAt: new Date() } },
    { session },
  );
}
