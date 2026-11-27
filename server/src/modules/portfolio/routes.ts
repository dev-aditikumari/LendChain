import { Router } from "express";
import { Disbursement, Entity, Invoice, InvoiceEvent, Program } from "../../models";
import { authenticate, check } from "../../middleware/auth";

export const portfolioRouter = Router();
portfolioRouter.use(authenticate);

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

portfolioRouter.get("/portfolio/overview", async (req, res) => {
  check(req, "portfolio:read", {});
  const now = new Date();

  const live = await Invoice.find({ status: { $in: ["DISBURSED", "OVERDUE"] } }).select("status financedAmount supplierId").lean();
  const outstanding = live.reduce((s, i) => s + (i.financedAmount ?? 0), 0);
  const overdue = live.filter((i) => i.status === "OVERDUE").reduce((s, i) => s + (i.financedAmount ?? 0), 0);

  const paid = await Disbursement.find({ status: "SUCCESS" }).select("amount rate disbursedOn").lean();
  const thisMonth = paid.filter((d) => d.disbursedOn && monthKey(d.disbursedOn) === monthKey(now));
  const totalPaid = paid.reduce((s, d) => s + (d.amount ?? 0), 0);
  const yieldPct = totalPaid ? paid.reduce((s, d) => s + (d.amount ?? 0) * (d.rate ?? 0), 0) / totalPaid : 0;

  // the last six months, oldest first, including months with nothing paid out
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - i), 1));
    return { key: monthKey(d), label: MONTH[d.getUTCMonth()], paise: 0 };
  });
  for (const d of paid) {
    const m = months.find((x) => d.disbursedOn && x.key === monthKey(d.disbursedOn));
    if (m) m.paise += d.amount ?? 0;
  }

  const statusCounts = await Invoice.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]);
  const count = (...s: string[]) => statusCounts.filter((x) => s.includes(x._id)).reduce((t, x) => t + x.n, 0);
  const statusMix = [
    { label: "Disbursed", value: count("DISBURSED"), color: "#6D4AFF" },
    { label: "Approved", value: count("APPROVED"), color: "#FFC94D" },
    { label: "Under review", value: count("SUBMITTED", "BUYER_CONFIRMED", "FINANCING_REQUESTED", "ENGINE_EVALUATED"), color: "#3447B8" },
    { label: "Repaid", value: count("REPAID"), color: "#CDBFFF" },
    { label: "Overdue", value: count("OVERDUE"), color: "#E5484D" },
  ].filter((s) => s.value > 0);

  const programs = await Program.find().sort({ sanctioned: -1 }).limit(5).lean();
  const names = new Map((await Entity.find({ _id: { $in: programs.flatMap((p) => [p.buyerId, p.supplierId]) } }).lean()).map((e) => [String(e._id), e.legalName]));

  const reached = async (to: string) => (await InvoiceEvent.distinct("invoiceId", { to })).length;
  const funnel = [
    { label: "Invoices submitted", value: await reached("SUBMITTED") },
    { label: "Buyer confirmed", value: await reached("BUYER_CONFIRMED") },
    { label: "Approved", value: await reached("APPROVED") },
    { label: "Disbursed", value: await reached("DISBURSED") },
    { label: "Repaid", value: await reached("REPAID") },
  ];

  res.json({
    outstanding, outstandingInvoices: live.length, suppliers: new Set(live.map((i) => String(i.supplierId))).size,
    disbursedThisMonth: thisMonth.reduce((s, d) => s + (d.amount ?? 0), 0), disbursedThisMonthCount: thisMonth.length,
    overdueRate: outstanding ? Math.round((overdue / outstanding) * 1000) / 10 : 0,
    averageYield: Math.round(yieldPct * 10) / 10,
    months: months.map(({ label, paise }) => ({ label, paise })),
    statusMix,
    topPrograms: programs.map((p) => ({
      id: String(p._id), buyer: names.get(String(p.buyerId)) ?? "Buyer", supplier: names.get(String(p.supplierId)) ?? "Supplier",
      sanctioned: p.sanctioned, used: p.outstanding ?? 0,
    })),
    funnel,
  });
});
