import { z } from "zod";

// facts the engine can read; the editor offers exactly these
export const FACTS = [
  { key: "invoiceAmount", label: "Invoice amount (paise)", kind: "number" },
  { key: "tenureDays", label: "Days to due date", kind: "number" },
  { key: "buyerRating", label: "Buyer rating", kind: "text" },
  { key: "supplierVintageMonths", label: "Supplier vintage (months)", kind: "number" },
  { key: "disputeCount", label: "Supplier disputed invoices", kind: "number" },
  { key: "concentrationPercent", label: "Program concentration (%)", kind: "number" },
  { key: "gstFiled", label: "GST registered", kind: "boolean" },
] as const;

const factKeys = FACTS.map((f) => f.key) as [string, ...string[]];
const kindOf = (key: string) => FACTS.find((f) => f.key === key)!.kind;

const leaf = z.object({
  fact: z.enum(factKeys),
  op: z.enum(["eq", "gt", "lt", "between", "in", "regex"]),
  value: z.unknown(),
}).superRefine((c, ctx) => {
  const bad = (message: string) => ctx.addIssue({ code: "custom", message, path: ["value"] });
  const kind = kindOf(c.fact);
  if (c.op === "gt" || c.op === "lt") {
    if (typeof c.value !== "number") bad("Needs a number");
    if (kind !== "number") bad(`${c.fact} cannot be compared with greater or less than`);
  } else if (c.op === "between") {
    const v = c.value;
    if (!Array.isArray(v) || v.length !== 2 || v.some((n) => typeof n !== "number") || v[0] > v[1]) bad("Needs two numbers, low then high");
  } else if (c.op === "in") {
    if (!Array.isArray(c.value) || c.value.length === 0) bad("Needs a list of values");
  } else if (c.op === "regex") {
    try { new RegExp(c.value as string); } catch { bad("Not a valid pattern"); }
  } else if (c.op === "eq") {
    const t = typeof c.value;
    if (t !== "number" && t !== "string" && t !== "boolean") bad("Needs a number, text or true/false");
    if (kind === "boolean" && t !== "boolean") bad(`${c.fact} is true or false`);
  }
});

// a condition is one comparison or an all/any group of conditions; routing by shape keeps the error on the field that is wrong
const group = (key: "all" | "any") => z.object({ [key]: z.array(z.lazy(() => condition)).min(1, "A group needs at least one condition") });
const condition: z.ZodType<any> = z.any().superRefine((v, ctx) => {
  const schema = v && typeof v === "object" && "all" in v ? group("all") : v && typeof v === "object" && "any" in v ? group("any") : leaf;
  const r = schema.safeParse(v);
  if (!r.success) for (const i of r.error.issues) ctx.addIssue({ ...(i as any), path: i.path });
});

const rule = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{2,40}$/, "Rule id: letters, digits, - and _ (2 to 40)"),
  type: z.enum(["eligibility", "scoring", "pricing"]),
  when: condition,
  then: z.object({
    decision: z.enum(["APPROVE", "REFER", "REJECT"]).optional(),
    reason: z.string().max(80).optional(),
    points: z.number().min(-200).max(200).optional(),
    rate: z.number().min(-20).max(20).optional(),
    fee: z.number().int().min(0).optional(),
    advancePercent: z.number().min(1).max(100).optional(),
  }),
}).superRefine((r, ctx) => {
  const need = (ok: boolean, message: string) => !ok && ctx.addIssue({ code: "custom", message, path: ["then"] });
  if (r.type === "eligibility") need(r.then.decision === "REJECT", "An eligibility rule must reject");
  if (r.type === "scoring") need(typeof r.then.points === "number", "A scoring rule needs points");
  if (r.type === "pricing") need(r.then.rate !== undefined || r.then.fee !== undefined || r.then.advancePercent !== undefined, "A pricing rule needs a rate, fee or advance");
});

const pricing = z.object({
  baseRate: z.number().min(0).max(60),
  minFee: z.number().int().min(0),
  feePercent: z.number().min(0).max(10),
  defaultAdvancePercent: z.number().min(1).max(100),
  scoreBands: z.array(z.object({ min: z.number(), premium: z.number().min(0).max(30) })).min(1),
  tenureSlabs: z.array(z.object({ upToDays: z.number().int().min(1), add: z.number().min(0).max(30) })).min(1),
  approveScore: z.number(),
  referScore: z.number(),
}).refine((p) => p.approveScore >= p.referScore, { message: "Approve score must be at least the refer score", path: ["approveScore"] });

export const ruleSetBody = z.object({
  rules: z.array(rule).max(100),
  pricing,
}).superRefine((b, ctx) => {
  const seen = new Set<string>();
  b.rules.forEach((r, i) => {
    if (seen.has(r.id)) ctx.addIssue({ code: "custom", message: `Duplicate rule id ${r.id}`, path: ["rules", i, "id"] });
    seen.add(r.id);
  });
});
