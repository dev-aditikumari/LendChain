import { RuleSet, Invoice, Entity, Program } from "../../models";
import { defaultRules, defaultPricing } from "./defaults";
import { Facts } from "./evaluator";

export async function publishedRuleSet() {
  let rs = await RuleSet.findOne({ status: "PUBLISHED" }).sort({ version: -1 }).lean();
  if (!rs) {
    rs = await RuleSet.findOneAndUpdate(
      { version: 1 },
      { $setOnInsert: { version: 1, status: "PUBLISHED", rules: defaultRules, pricing: defaultPricing } },
      { upsert: true, returnDocument: "after" },
    ).lean();
  }
  return rs;
}

export async function factsFor(invoice: any): Promise<Facts> {
  const [supplier, buyer, program, disputeCount] = await Promise.all([
    Entity.findById(invoice.supplierId).lean(),
    Entity.findById(invoice.buyerId).lean(),
    Program.findById(invoice.programId).lean(),
    Invoice.countDocuments({ supplierId: invoice.supplierId, status: "DISPUTED" }),
  ]);
  const day = 24 * 3600 * 1000;
  return {
    invoiceAmount: invoice.amount,
    tenureDays: Math.ceil((new Date(invoice.dueDate).getTime() - Date.now()) / day),
    buyerRating: buyer?.rating,
    supplierVintageMonths: supplier?.vintageMonths ?? 0,
    disputeCount,
    concentrationPercent: program ? Math.round(((program.outstanding + invoice.amount) / program.sanctioned) * 100) : 0,
    gstFiled: Boolean(supplier?.gstin),
  };
}
