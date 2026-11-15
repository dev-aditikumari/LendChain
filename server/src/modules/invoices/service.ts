import { ClientSession } from "mongoose";
import { Invoice, InvoiceEvent } from "../../models";
import { InvoiceStatus, assertTransition } from "./stateMachine";
import { conflict } from "../../shared/errors";

// moves the invoice only if status and version are still what we read
export async function move(invoice: any, to: InvoiceStatus, actor: string | undefined, set: Record<string, unknown> = {}, session?: ClientSession, note?: string) {
  assertTransition(invoice.status, to);
  const res = await Invoice.updateOne(
    { _id: invoice._id, status: invoice.status, version: invoice.version },
    { $set: { status: to, ...set }, $inc: { version: 1 } },
    { session },
  );
  if (res.modifiedCount !== 1) throw conflict("Invoice was changed by someone else, reload and retry", "VERSION_CONFLICT");
  await InvoiceEvent.create([{ invoiceId: invoice._id, from: invoice.status, to, actor, note }], { session });
  invoice.status = to;
  invoice.version += 1;
  Object.assign(invoice, set);
}
