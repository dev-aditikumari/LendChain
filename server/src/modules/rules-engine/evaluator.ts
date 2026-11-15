export type Op = "eq" | "gt" | "lt" | "between" | "in" | "regex";

export type Condition =
  | { fact: string; op: Op; value: unknown }
  | { all: Condition[] }
  | { any: Condition[] };

export interface Rule {
  id: string;
  type: "eligibility" | "scoring" | "pricing";
  when: Condition;
  then: {
    decision?: "APPROVE" | "REFER" | "REJECT";
    reason?: string;
    points?: number;
    rate?: number;
    fee?: number;
    advancePercent?: number;
  };
}

export type Facts = Record<string, unknown>;

export interface TraceEntry {
  ruleId: string;
  type: Rule["type"];
  fired: boolean;
  inputs: Record<string, unknown>;
}

export function evalCondition(c: Condition, facts: Facts, used: Set<string>): boolean {
  if ("all" in c) return c.all.every((x) => evalCondition(x, facts, used));
  if ("any" in c) return c.any.some((x) => evalCondition(x, facts, used));
  used.add(c.fact);
  const actual = facts[c.fact];
  switch (c.op) {
    case "eq": return actual === c.value;
    case "gt": return typeof actual === "number" && actual > (c.value as number);
    case "lt": return typeof actual === "number" && actual < (c.value as number);
    case "between": {
      const [lo, hi] = c.value as [number, number];
      return typeof actual === "number" && actual >= lo && actual <= hi;
    }
    case "in": return (c.value as unknown[]).includes(actual);
    case "regex": return typeof actual === "string" && new RegExp(c.value as string).test(actual);
  }
}

export interface PricingConfig {
  baseRate: number;
  minFee: number;
  feePercent: number;
  defaultAdvancePercent: number;
  scoreBands: { min: number; premium: number }[];
  tenureSlabs: { upToDays: number; add: number }[];
  approveScore: number;
  referScore: number;
}

export interface EvaluationResult {
  decision: "APPROVE" | "REFER" | "REJECT";
  score: number;
  rate: number;
  fee: number;
  advancePercent: number;
  reasons: string[];
  trace: TraceEntry[];
}

export function evaluate(rules: Rule[], pricing: PricingConfig, facts: Facts): EvaluationResult {
  const trace: TraceEntry[] = [];
  const reasons: string[] = [];
  let score = 0;
  let rejected = false;
  let rate = pricing.baseRate;
  let advancePercent = pricing.defaultAdvancePercent;
  let feeOverride: number | undefined;

  for (const rule of rules) {
    const used = new Set<string>();
    const fired = evalCondition(rule.when, facts, used);
    const inputs: Record<string, unknown> = {};
    used.forEach((k) => (inputs[k] = facts[k]));
    trace.push({ ruleId: rule.id, type: rule.type, fired, inputs });
    if (!fired) continue;

    if (rule.type === "eligibility" && rule.then.decision === "REJECT") {
      rejected = true;
      if (rule.then.reason) reasons.push(rule.then.reason);
    } else if (rule.type === "scoring") {
      score += rule.then.points ?? 0;
      if (rule.then.reason) reasons.push(rule.then.reason);
    } else if (rule.type === "pricing") {
      if (rule.then.rate !== undefined) rate += rule.then.rate;
      if (rule.then.fee !== undefined) feeOverride = rule.then.fee;
      if (rule.then.advancePercent !== undefined) advancePercent = rule.then.advancePercent;
    }
  }

  const band = [...pricing.scoreBands].sort((a, b) => b.min - a.min).find((b) => score >= b.min);
  rate += band ? band.premium : 0;
  const tenure = Number(facts.tenureDays ?? 0);
  const slab = [...pricing.tenureSlabs].sort((a, b) => a.upToDays - b.upToDays).find((s) => tenure <= s.upToDays);
  rate += slab ? slab.add : 0;

  const amount = Number(facts.invoiceAmount ?? 0);
  const financed = Math.round((amount * advancePercent) / 100);
  const fee = feeOverride ?? Math.max(pricing.minFee, Math.round((financed * pricing.feePercent) / 100));

  let decision: EvaluationResult["decision"];
  if (rejected) decision = "REJECT";
  else if (score >= pricing.approveScore) decision = "APPROVE";
  else if (score >= pricing.referScore) decision = "REFER";
  else {
    decision = "REJECT";
    reasons.push("SCORE_TOO_LOW");
  }

  return { decision, score, rate: Math.round(rate * 100) / 100, fee, advancePercent, reasons, trace };
}
