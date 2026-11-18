import mongoose from "mongoose";
import { AccrualRun, Disbursement, Invoice } from "../../models";
import { badRequest } from "../../shared/errors";
import { accrualForDay, accrualLines } from "./posting";
import { assertOpen } from "./periods";
import { post } from "./repository";

const DAY = 86400000;
export const utcDay = (d: Date) => d.toISOString().slice(0, 10);
const dayNumber = (day: string) => Math.floor(new Date(`${day}T00:00:00.000Z`).getTime() / DAY);

export function yesterday(now = new Date()) {
  return utcDay(new Date(now.getTime() - DAY));
}

export interface AccrualResult {
  date: string;
  alreadyRun: boolean;
  count: number;
  amount: number;
}

// Recognises one day of upfront interest on every open payout. A date can only be run once:
// the run record has a unique date and is written in the same transaction as the postings.
export async function runAccruals(date: string, by?: string, source: "MANUAL" | "SCHEDULE" = "MANUAL", now = new Date()): Promise<AccrualResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T00:00:00.000Z`).getTime()) || utcDay(new Date(`${date}T00:00:00.000Z`)) !== date) {
    throw badRequest("Date must look like 2026-11-17");
  }
  if (date >= utcDay(now)) throw badRequest("Accruals can only be run for a day that has finished", "DATE_NOT_FINISHED");
  const at = new Date(`${date}T12:00:00.000Z`);

  const existing = await AccrualRun.findOne({ date }).lean();
  if (existing) return { date, alreadyRun: true, count: existing.count ?? 0, amount: existing.amount ?? 0 };
  await assertOpen(at);

  const session = await mongoose.startSession();
  let result: AccrualResult = { date, alreadyRun: false, count: 0, amount: 0 };
  try {
    await session.withTransaction(async () => {
      result = { date, alreadyRun: false, count: 0, amount: 0 };
      const [run] = await AccrualRun.create([{ date, count: 0, amount: 0, runBy: by, source }], { session });
      const endOfDay = new Date(`${date}T23:59:59.999Z`);
      const payouts = await Disbursement.find({ status: "SUCCESS", upfrontInterest: { $gt: 0 }, disbursedOn: { $lte: endOfDay } }).session(session);
      for (const d of payouts) {
        const inv = await Invoice.findById(d.invoiceId).session(session);
        if (!inv || !["DISBURSED", "OVERDUE"].includes(inv.status)) continue;
        const k = dayNumber(date) - dayNumber(utcDay(d.disbursedOn!));
        const days = d.accrualDays ?? 1;
        if (k < 0 || k >= days) continue;
        const total = d.upfrontInterest ?? 0;
        const amount = Math.min(accrualForDay(total, days, k), total - (d.accruedInterest ?? 0));
        if (amount <= 0) continue;
        await post(`accrual-${date}-${d._id}`, inv._id, accrualLines(amount), `interest accrual ${date}`, session, { postedOn: at, disbursementId: d._id });
        await Disbursement.updateOne({ _id: d._id }, { $inc: { accruedInterest: amount } }, { session });
        result.count += 1;
        result.amount += amount;
      }
      await AccrualRun.updateOne({ _id: run._id }, { $set: { count: result.count, amount: result.amount } }, { session });
    });
  } catch (e: any) {
    // another request ran the same date first
    if (e?.code === 11000) {
      const won = await AccrualRun.findOne({ date }).lean();
      return { date, alreadyRun: true, count: won?.count ?? 0, amount: won?.amount ?? 0 };
    }
    throw e;
  } finally {
    await session.endSession();
  }
  return result;
}

// when an invoice is repaid, whatever interest is still unearned becomes income
export async function releaseUnearned(invoiceId: any, session: mongoose.ClientSession) {
  const d = await Disbursement.findOne({ invoiceId, status: "SUCCESS" }).session(session);
  if (!d) return;
  const remaining = (d.upfrontInterest ?? 0) - (d.accruedInterest ?? 0);
  if (remaining <= 0) return;
  await post(`accrual-final-${d._id}`, invoiceId, accrualLines(remaining), "interest released on repayment", session, { disbursementId: d._id });
  await Disbursement.updateOne({ _id: d._id }, { $inc: { accruedInterest: remaining } }, { session });
}
