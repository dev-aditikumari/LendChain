import bcrypt from "bcryptjs";
import { Disbursement, Entity, FollowUp, Invoice, InvoiceEvent, Program, Repayment, RuleEvaluation, User } from "./models";
import { publishedRuleSet } from "./modules/rules-engine/service";
import { evaluate } from "./modules/rules-engine/evaluator";
import { accrualLines, disbursementLines, repaymentLines } from "./modules/ledger/posting";
import { post } from "./modules/ledger/repository";
import { interestFor } from "./shared/money";

export async function seedDemo(password: string) {
  const hash = await bcrypt.hash(password, 10);
  if (await User.exists({ email: "admin@lendchain.test" })) return;

  const suppliers = await Entity.create([
    { kind: "SUPPLIER", legalName: "Sharma Components Pvt Ltd", pan: "ABCDE1234F", gstin: "27ABCDE1234F1Z5", vintageMonths: 30, bankAccount: "50100234567891", kycStatus: "VERIFIED" },
    { kind: "SUPPLIER", legalName: "Rao Textiles", pan: "ABCDE1234G", gstin: "29ABCDE1234G1Z5", vintageMonths: 8, bankAccount: "60200345670000", kycStatus: "VERIFIED" },
  ]);
  const buyer = await Entity.create({ kind: "BUYER", legalName: "Tata Motors Ltd", pan: "AAACT1234B", gstin: "27AAACT1234B1Z5", rating: "AA", kycStatus: "VERIFIED", contactName: "Anil Kapoor", contactEmail: "accounts.payable@tatamotors.example" });
  for (const s of suppliers) await Program.create({ supplierId: s._id, buyerId: buyer._id, sanctioned: 2500000 * 100 });
  // buyers with overdue invoices, for the collections screens
  const lateBuyers = await Entity.create([
    { kind: "BUYER", legalName: "Mahindra Logistics Ltd", pan: "AAACM1234C", gstin: "27AAACM1234C1Z5", rating: "A", kycStatus: "VERIFIED", contactName: "Rekha Pillai", contactEmail: "payables@mahindralogistics.example" },
    { kind: "BUYER", legalName: "Lotus Textiles Pvt Ltd", pan: "AAACL1234D", gstin: "24AAACL1234D1Z5", rating: "BBB", kycStatus: "VERIFIED", contactName: "Sameer Shah", contactEmail: "accounts@lotustextiles.example" },
    { kind: "BUYER", legalName: "Deccan Packaging Ltd", pan: "AAACD1234E", gstin: "36AAACD1234E1Z5", rating: "BB", kycStatus: "VERIFIED", contactName: "Neha Gupta", contactEmail: "finance@deccanpackaging.example" },
  ]);
  for (const b of lateBuyers) await Program.create({ supplierId: suppliers[0]._id, buyerId: b._id, sanctioned: 4000000 * 100 });

  const people: [string, string, object][] = [
    ["supplier@lendchain.test", "SUPPLIER", { entityId: suppliers[0]._id }],
    ["supplier2@lendchain.test", "SUPPLIER", { entityId: suppliers[1]._id }],
    ["buyer@lendchain.test", "BUYER", { entityId: buyer._id }],
    ["analyst@lendchain.test", "ANALYST", {}],
    ["approver@lendchain.test", "APPROVER", { approvalLimit: 500000 * 100 }],
    ["finance@lendchain.test", "FINANCE_OPS", {}],
    ["finance2@lendchain.test", "FINANCE_OPS", {}],
    ["ops@lendchain.test", "OPERATIONS", {}],
    ["accounts@lendchain.test", "ACCOUNTS", {}],
    ["accounts2@lendchain.test", "ACCOUNTS", {}],
    ["collections@lendchain.test", "COLLECTIONS", {}],
    ["risk1@lendchain.test", "RISK_ADMIN", {}],
    ["risk2@lendchain.test", "RISK_ADMIN", {}],
    ["admin@lendchain.test", "ADMIN", {}],
  ];
  for (const [email, role, extra] of people) {
    await User.create({ email, name: email.split("@")[0], role, passwordHash: hash, ...extra });
  }
  const rs = await publishedRuleSet();
  await seedHistory(suppliers[0], buyer, rs);
  await seedOverdue(suppliers[0], lateBuyers, rs);
}

const at = (monthsAgo: number, day: number) => {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() - monthsAgo, day, 10));
};

// two invoices that were paid out and repaid in earlier months, so the ledger, trial balance and
// period close have history to work with. Postings use the real posting rules, dated in the past.
async function seedHistory(supplier: any, buyer: any, rs: any) {
  const program = await Program.findOne({ supplierId: supplier._id });
  const users = Object.fromEntries((await User.find().lean()).map((u: any) => [u.email.split("@")[0], u._id]));
  const specs = [
    { number: "INV-1101", rupees: 200000, issued: at(2, 3), disbursed: at(2, 6), repaid: at(2, 26), due: at(2, 26), utr: "UTR-710001" },
    { number: "INV-1102", rupees: 150000, issued: at(1, 8), disbursed: at(1, 10), repaid: at(1, 24), due: at(1, 25), utr: "UTR-710002" },
  ];
  for (const sp of specs) {
    const amount = sp.rupees * 100;
    const advance = Math.round(amount * 0.8);
    const days = Math.max(1, Math.ceil((sp.due.getTime() - sp.disbursed.getTime()) / 86400000));
    const facts = { invoiceAmount: amount, tenureDays: days, buyerRating: "AA", supplierVintageMonths: 30, disputeCount: 0, concentrationPercent: 10, gstFiled: true };
    const result = evaluate(rs.rules, rs.pricing, facts);
    const inv = await Invoice.create({
      number: sp.number, supplierId: supplier._id, buyerId: buyer._id, programId: program!._id, amount,
      issueDate: sp.issued, dueDate: sp.due, status: "REPAID", createdBy: users.supplier, recommendedBy: users.analyst,
      approvedBy: users.approver, advancePercent: 80, tenureDays: days, financedAmount: advance, disbursedAt: sp.disbursed,
    });
    const upfront = interestFor(advance, result.rate, days);
    const d = await Disbursement.create({
      invoiceId: inv._id, amount: advance, fee: result.fee, upfrontInterest: upfront, net: advance - result.fee - upfront, rate: result.rate,
      status: "SUCCESS", reference: "LCPAY" + String(inv._id).slice(-8).toUpperCase(), bankStatus: "CONFIRMED", initiatedBy: users.finance,
      authorisedBy: users.finance2, disbursedOn: sp.disbursed, accrualDays: days, accruedInterest: upfront,
    });
    await RuleEvaluation.create({ invoiceId: inv._id, ruleSetVersion: rs.version, facts, result });

    const trail: [string, Date, any, string?][] = [
      ["SUBMITTED", sp.issued, users.supplier], ["BUYER_CONFIRMED", sp.issued, users.buyer], ["FINANCING_REQUESTED", sp.issued, users.supplier],
      ["ENGINE_EVALUATED", sp.issued, users.supplier], ["APPROVED", sp.disbursed, users.approver, "Approved at the engine rate."],
      ["DISBURSED", sp.disbursed, users.finance2], ["REPAID", sp.repaid, users.buyer],
    ];
    let from = "DRAFT";
    for (const [to, when, actor, note] of trail) {
      await InvoiceEvent.create({ invoiceId: inv._id, from, to, actor, note, createdAt: when });
      from = to;
    }

    await post(String(d._id), inv._id, disbursementLines({ advance, fee: result.fee, upfrontInterest: upfront }), "disbursement", undefined, { reference: d.reference ?? undefined, disbursementId: d._id, postedOn: sp.disbursed });
    const allocated = { penal: 0, fees: 0, interest: 0, principal: advance };
    await Repayment.create({ invoiceId: inv._id, amount: advance, utr: sp.utr, allocation: allocated, recordedBy: users.buyer });
    await post(`rep-${sp.utr}`, inv._id, repaymentLines(allocated), "repayment", undefined, { reference: sp.utr, postedOn: sp.repaid });
    await post(`accrual-final-${d._id}`, inv._id, accrualLines(upfront), "interest released on repayment", undefined, { disbursementId: d._id, postedOn: sp.repaid });
  }
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);

// four invoices that are past their due date, one in each ageing bucket, and five that were paid out
// recently and are still within their term, with a few follow-ups, so the collections and
// portfolio screens have something real to show
async function seedOverdue(supplier: any, buyers: any[], rs: any) {
  const users = Object.fromEntries((await User.find().lean()).map((u: any) => [u.email.split("@")[0], u._id]));
  const specs = [
    { number: "INV-1884", buyer: buyers[2], rupees: 310000, overdueDays: 104 },
    { number: "INV-1930", buyer: buyers[1], rupees: 540000, overdueDays: 71 },
    { number: "INV-1962", buyer: buyers[0], rupees: 1380000, overdueDays: 38 },
    { number: "INV-1987", buyer: buyers[0], rupees: 720000, overdueDays: 12 },
    { number: "INV-2011", buyer: buyers[0], rupees: 1500000, overdueDays: -22 },
    { number: "INV-2012", buyer: buyers[1], rupees: 1000000, overdueDays: -30 },
    { number: "INV-2013", buyer: buyers[0], rupees: 1000000, overdueDays: -41 },
    { number: "INV-2019", buyer: buyers[1], rupees: 1200000, overdueDays: -35 },
    { number: "INV-2020", buyer: buyers[2], rupees: 1000000, overdueDays: -27 },
  ];
  const made: Record<string, any> = {};
  for (const sp of specs) {
    const amount = sp.rupees * 100;
    const advance = Math.round(amount * 0.8);
    const live = sp.overdueDays < 0;
    const due = daysAgo(sp.overdueDays);
    // overdue invoices were paid out 45 days before they fell due; live ones 10 days ago
    const disbursed = live ? daysAgo(10) : daysAgo(sp.overdueDays + 45);
    const issued = live ? daysAgo(13) : daysAgo(sp.overdueDays + 48);
    const days = Math.max(1, Math.ceil((due.getTime() - disbursed.getTime()) / 86400000));
    const facts = { invoiceAmount: amount, tenureDays: days, buyerRating: sp.buyer.rating, supplierVintageMonths: 30, disputeCount: 0, concentrationPercent: 10, gstFiled: true };
    const result = evaluate(rs.rules, rs.pricing, facts);
    const program = await Program.findOne({ supplierId: supplier._id, buyerId: sp.buyer._id });
    const inv = await Invoice.create({
      number: sp.number, supplierId: supplier._id, buyerId: sp.buyer._id, programId: program!._id, amount,
      issueDate: issued, dueDate: due, status: live ? "DISBURSED" : "OVERDUE", createdBy: users.supplier, recommendedBy: users.analyst,
      approvedBy: users.approver, advancePercent: 80, tenureDays: days, financedAmount: advance, disbursedAt: disbursed,
    });
    const upfront = interestFor(advance, result.rate, days);
    const d = await Disbursement.create({
      invoiceId: inv._id, amount: advance, fee: result.fee, upfrontInterest: upfront, net: advance - result.fee - upfront, rate: result.rate,
      status: "SUCCESS", reference: "LCPAY" + String(inv._id).slice(-8).toUpperCase(), bankStatus: "CONFIRMED", initiatedBy: users.finance,
      authorisedBy: users.finance2, disbursedOn: disbursed, accrualDays: days, accruedInterest: live ? 0 : upfront,
    });
    await RuleEvaluation.create({ invoiceId: inv._id, ruleSetVersion: rs.version, facts, result });
    const trail: [string, Date, any, string?][] = [
      ["SUBMITTED", issued, users.supplier], ["BUYER_CONFIRMED", issued, users.buyer], ["FINANCING_REQUESTED", issued, users.supplier],
      ["ENGINE_EVALUATED", issued, users.supplier], ["APPROVED", disbursed, users.approver, "Approved at the engine rate."],
      ["DISBURSED", disbursed, users.finance2],
      ...(live ? [] : [["OVERDUE", due, undefined, "Past the due date without repayment."] as [string, Date, any, string?]]),
    ];
    let from = "DRAFT";
    for (const [to, when, actor, note] of trail) {
      await InvoiceEvent.create({ invoiceId: inv._id, from, to, actor, note, createdAt: when });
      from = to;
    }
    await post(String(d._id), inv._id, disbursementLines({ advance, fee: result.fee, upfrontInterest: upfront }), "disbursement", undefined, { reference: d.reference ?? undefined, disbursementId: d._id, postedOn: disbursed });
    // once the term has run out all of the upfront interest is earned; a live invoice earns it day by day
    if (!live) await post(`accrual-final-${d._id}`, inv._id, accrualLines(upfront), "interest earned over the term", undefined, { disbursementId: d._id, postedOn: due });
    await Program.updateOne({ _id: program!._id }, { $inc: { outstanding: advance } });
    made[sp.number] = inv;
  }
  await FollowUp.create([
    { invoiceId: made["INV-1962"]._id, channel: "CALL", note: "Spoke to Rekha. Payment is stuck with their approver; she will chase it.", promisedOn: daysAgo(-5), promisedAmount: made["INV-1962"].financedAmount, nextOn: daysAgo(-5), status: "OPEN", by: users.collections, createdAt: daysAgo(3) },
    { invoiceId: made["INV-1930"]._id, channel: "EMAIL", note: "Sent the second reminder with the statement attached.", status: "DONE", doneAt: daysAgo(10), by: users.collections, createdAt: daysAgo(10) },
    { invoiceId: made["INV-1884"]._id, channel: "VISIT", note: "Visited the plant. Buyer disputes the delivery quantity; asked them to put it in writing.", nextOn: daysAgo(-2), status: "OPEN", by: users.collections, createdAt: daysAgo(6) },
  ]);
}
