import { Rule, PricingConfig } from "./evaluator";

export const defaultRules: Rule[] = [
  { id: "R-TENURE-CAP", type: "eligibility", when: { fact: "tenureDays", op: "gt", value: 90 }, then: { decision: "REJECT", reason: "TENURE_EXCEEDS_90_DAYS" } },
  { id: "R-GST", type: "eligibility", when: { fact: "gstFiled", op: "eq", value: false }, then: { decision: "REJECT", reason: "GST_NOT_FILED" } },
  { id: "R-RATING-HIGH", type: "scoring", when: { fact: "buyerRating", op: "in", value: ["AAA", "AA"] }, then: { points: 50 } },
  { id: "R-RATING-MID", type: "scoring", when: { fact: "buyerRating", op: "eq", value: "A" }, then: { points: 30 } },
  { id: "R-VINTAGE-LONG", type: "scoring", when: { fact: "supplierVintageMonths", op: "gt", value: 12 }, then: { points: 20 } },
  { id: "R-VINTAGE-MID", type: "scoring", when: { fact: "supplierVintageMonths", op: "between", value: [6, 12] }, then: { points: 10 } },
  { id: "R-GST-OK", type: "scoring", when: { fact: "gstFiled", op: "eq", value: true }, then: { points: 10 } },
  { id: "R-DISPUTES", type: "scoring", when: { fact: "disputeCount", op: "gt", value: 2 }, then: { points: -30, reason: "DISPUTE_HISTORY" } },
  { id: "R-CONCENTRATION", type: "scoring", when: { fact: "concentrationPercent", op: "gt", value: 80 }, then: { points: -20, reason: "HIGH_CONCENTRATION" } },
];

export const defaultPricing: PricingConfig = {
  baseRate: 10,
  minFee: 10000,
  feePercent: 0.5,
  defaultAdvancePercent: 80,
  scoreBands: [{ min: 70, premium: 0 }, { min: 40, premium: 2 }],
  tenureSlabs: [{ upToDays: 30, add: 0 }, { upToDays: 60, add: 1 }, { upToDays: 90, add: 2 }],
  approveScore: 60,
  referScore: 40,
};
