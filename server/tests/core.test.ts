import { describe, it, expect } from "vitest";
import { evaluate, Rule, PricingConfig } from "../src/modules/rules-engine/evaluator";
import { allocateRepayment, disbursementLines, repaymentLines, assertBalanced } from "../src/modules/ledger/posting";
import { canTransition, assertTransition } from "../src/modules/invoices/stateMachine";
import { interestFor, toPaise } from "../src/shared/money";

const pricing: PricingConfig = {
  baseRate: 10, minFee: 10000, feePercent: 0.5, defaultAdvancePercent: 80,
  scoreBands: [{ min: 70, premium: 0 }, { min: 40, premium: 2 }],
  tenureSlabs: [{ upToDays: 30, add: 0 }, { upToDays: 60, add: 1 }, { upToDays: 90, add: 2 }],
  approveScore: 60, referScore: 40,
};

const rules: Rule[] = [
  { id: "R-TENURE-CAP", type: "eligibility", when: { all: [{ fact: "tenureDays", op: "gt", value: 90 }] }, then: { decision: "REJECT", reason: "TENURE_EXCEEDS_90_DAYS" } },
  { id: "R-BUYER-RATING", type: "scoring", when: { fact: "buyerRating", op: "in", value: ["AAA", "AA"] }, then: { points: 50 } },
  { id: "R-VINTAGE", type: "scoring", when: { fact: "supplierVintageMonths", op: "gt", value: 12 }, then: { points: 20 } },
  { id: "R-DISPUTES", type: "scoring", when: { fact: "disputeCount", op: "gt", value: 2 }, then: { points: -30, reason: "DISPUTE_HISTORY" } },
];

const base = { invoiceAmount: toPaise(100000), tenureDays: 45, buyerRating: "AA", supplierVintageMonths: 24, disputeCount: 0 };

describe("rule engine", () => {
  it("approves a good invoice and prices it", () => {
    const r = evaluate(rules, pricing, base);
    expect(r.decision).toBe("APPROVE");
    expect(r.score).toBe(70);
    expect(r.rate).toBe(11);
    expect(r.advancePercent).toBe(80);
    expect(r.fee).toBe(40000);
  });
  it("rejects on a knock-out rule", () => {
    const r = evaluate(rules, pricing, { ...base, tenureDays: 120 });
    expect(r.decision).toBe("REJECT");
    expect(r.reasons).toContain("TENURE_EXCEEDS_90_DAYS");
  });
  it("refers a middling score", () => {
    const r = evaluate(rules, pricing, { ...base, supplierVintageMonths: 3 });
    expect(r.decision).toBe("REFER");
  });
  it("gives the same result when rerun with the same inputs", () => {
    expect(evaluate(rules, pricing, base)).toEqual(evaluate(rules, pricing, base));
  });
  it("records a trace entry for every rule with its inputs", () => {
    const r = evaluate(rules, pricing, base);
    expect(r.trace).toHaveLength(rules.length);
    expect(r.trace[0]).toMatchObject({ ruleId: "R-TENURE-CAP", fired: false, inputs: { tenureDays: 45 } });
  });
  it("supports nested any/all and between/regex", () => {
    const r: Rule[] = [{ id: "X", type: "scoring", when: { any: [{ all: [{ fact: "a", op: "between", value: [1, 5] }, { fact: "s", op: "regex", value: "^AB" }] }, { fact: "z", op: "eq", value: 1 }] }, then: { points: 100 } }];
    expect(evaluate(r, pricing, { a: 3, s: "ABC" }).score).toBe(100);
    expect(evaluate(r, pricing, { a: 9, s: "ABC" }).score).toBe(0);
    expect(evaluate(r, pricing, { z: 1 }).score).toBe(100);
  });
});

describe("ledger", () => {
  it("disbursement entries balance", () => {
    const lines = disbursementLines({ advance: 8000000, fee: 40000, upfrontInterest: 100000 });
    const d = lines.reduce((s, l) => s + l.debit, 0);
    const c = lines.reduce((s, l) => s + l.credit, 0);
    expect(d).toBe(c);
  });
  it("rejects unbalanced or fractional entries", () => {
    expect(() => assertBalanced([{ account: "BANK", debit: 100, credit: 0 }, { account: "LENDER_POOL", debit: 0, credit: 90 }])).toThrow();
    expect(() => assertBalanced([{ account: "BANK", debit: 1.5, credit: 0 }, { account: "LENDER_POOL", debit: 0, credit: 1.5 }])).toThrow();
  });
  it("allocates penal, fees, interest, principal in order", () => {
    const dues = { penal: 100, fees: 200, interest: 300, principal: 1000 };
    expect(allocateRepayment(250, dues).allocated).toEqual({ penal: 100, fees: 150, interest: 0, principal: 0 });
    const full = allocateRepayment(2000, dues);
    expect(full.allocated).toEqual(dues);
    expect(full.excess).toBe(400);
  });
  it("repayment entries balance", () => {
    const lines = repaymentLines({ penal: 100, fees: 200, interest: 300, principal: 1000 });
    expect(lines.reduce((s, l) => s + l.debit, 0)).toBe(lines.reduce((s, l) => s + l.credit, 0));
  });
});

describe("state machine and money", () => {
  it("allows the happy path and blocks jumps", () => {
    expect(canTransition("DRAFT", "SUBMITTED")).toBe(true);
    expect(() => assertTransition("DRAFT", "DISBURSED")).toThrow();
    expect(() => assertTransition("REPAID", "OVERDUE")).toThrow();
  });
  it("computes interest in whole paise", () => {
    expect(interestFor(1000000, 12, 30)).toBe(9863);
  });
});
