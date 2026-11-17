import { Router } from "express";
import { RuleSet, RuleEvaluation, Invoice, User } from "../../models";
import { authenticate, check } from "../../middleware/auth";
import { can } from "../rbac/policy";
import { badRequest, conflict, forbidden, notFound } from "../../shared/errors";
import { audit } from "../../shared/audit";
import { evaluate } from "./evaluator";
import { FACTS, ruleSetBody } from "./schema";
import { publishedRuleSet } from "./service";

export const ruleSetRouter = Router();
ruleSetRouter.use(authenticate);

// risk admins edit; credit staff may read what the engine will apply
function canRead(req: any) {
  const ok = ["rule:propose", "credit:review", "invoice:approve"].some((p) => can(req.actor, p as any).ok);
  if (!ok) throw forbidden("ROLE_NOT_ALLOWED");
}

const names = async (ids: unknown[]) => {
  const users = await User.find({ _id: { $in: ids.filter(Boolean) } }, "name").lean();
  return new Map(users.map((u: any) => [String(u._id), u.name as string]));
};

const view = (rs: any, who: Map<string, string>) => ({
  ...rs,
  createdByName: who.get(String(rs.createdBy)),
  publishedByName: who.get(String(rs.publishedBy)),
});

ruleSetRouter.get("/facts", (req, res) => {
  canRead(req);
  res.json(FACTS);
});

ruleSetRouter.get("/", async (req, res) => {
  canRead(req);
  const sets = await RuleSet.find().sort({ version: -1 }).lean();
  const who = await names(sets.flatMap((s: any) => [s.createdBy, s.publishedBy]));
  res.json(sets.map((s) => view(s, who)));
});

ruleSetRouter.get("/:id", async (req, res) => {
  canRead(req);
  const rs = await RuleSet.findById(req.params.id).lean();
  if (!rs) throw notFound("Rule set");
  res.json(view(rs, await names([rs.createdBy, rs.publishedBy])));
});

ruleSetRouter.post("/", async (req, res) => {
  check(req, "rule:propose", {});
  const body = ruleSetBody.parse(req.body);
  const last = await RuleSet.findOne().sort({ version: -1 }).lean();
  const rs = await RuleSet.create({ ...body, version: (last?.version ?? 0) + 1, createdBy: req.actor.id });
  await audit(req, "ruleset.propose", String(rs._id), null, { version: rs.version });
  res.status(201).json(rs);
});

async function ownDraft(req: any) {
  check(req, "rule:propose", {});
  const rs = await RuleSet.findById(req.params.id);
  if (!rs) throw notFound("Rule set");
  if (rs.status !== "DRAFT") throw conflict("Only a draft can be changed", "NOT_A_DRAFT");
  if (String(rs.createdBy) !== req.actor.id) throw forbidden("NOT_YOUR_DRAFT");
  return rs;
}

ruleSetRouter.put("/:id", async (req, res) => {
  const rs = await ownDraft(req);
  const body = ruleSetBody.parse(req.body);
  rs.rules = body.rules as any;
  rs.pricing = body.pricing as any;
  rs.markModified("rules");
  rs.markModified("pricing");
  await rs.save();
  await audit(req, "ruleset.edit", String(rs._id), null, { version: rs.version, rules: body.rules.length });
  res.json(rs);
});

ruleSetRouter.delete("/:id", async (req, res) => {
  const rs = await ownDraft(req);
  await rs.deleteOne();
  await audit(req, "ruleset.discard", String(rs._id), null, { version: rs.version });
  res.status(204).end();
});

ruleSetRouter.post("/:id/publish", async (req, res) => {
  const rs = await RuleSet.findById(req.params.id);
  if (!rs) throw notFound("Rule set");
  check(req, "rule:publish", { createdBy: String(rs.createdBy) });
  if (rs.status !== "DRAFT") throw conflict("Only a draft can be published", "NOT_A_DRAFT");
  ruleSetBody.parse({ rules: rs.rules, pricing: rs.pricing });

  // claim the draft first so two publishes cannot both win
  const claimed = await RuleSet.findOneAndUpdate(
    { _id: rs._id, status: "DRAFT" },
    { status: "PUBLISHED", publishedBy: req.actor.id },
    { returnDocument: "after" },
  );
  if (!claimed) throw conflict("Only a draft can be published", "NOT_A_DRAFT");
  await RuleSet.updateMany({ status: "PUBLISHED", _id: { $ne: rs._id } }, { status: "ARCHIVED" });
  await audit(req, "ruleset.publish", String(rs._id), null, { version: claimed.version });
  res.json(claimed);
});

// back-test: run the live rules and this set over recent evaluations and compare
ruleSetRouter.post("/:id/simulate", async (req, res) => {
  check(req, "rule:propose", {});
  const rs = await RuleSet.findById(req.params.id).lean();
  if (!rs) throw notFound("Rule set");
  const live = await publishedRuleSet();
  if (!live) throw badRequest("No live rule set");

  const past = await RuleEvaluation.find().sort({ createdAt: -1 }).limit(500).lean();
  const invoices = await Invoice.find({ _id: { $in: past.map((p: any) => p.invoiceId) } }, "number amount").lean();
  const inv = new Map(invoices.map((i: any) => [String(i._id), i]));

  const rows = past.map((p: any) => {
    const before = evaluate(live.rules as any, live.pricing as any, p.facts);
    const after = evaluate(rs.rules as any, rs.pricing as any, p.facts);
    const i: any = inv.get(String(p.invoiceId));
    return {
      invoiceId: p.invoiceId,
      number: i?.number,
      amount: i?.amount,
      before: { decision: before.decision, score: before.score, rate: before.rate },
      after: { decision: after.decision, score: after.score, rate: after.rate },
      changed: before.decision !== after.decision,
    };
  });

  const count = (key: "before" | "after", d: string) => rows.filter((r) => r[key].decision === d).length;
  const avgRate = (key: "before" | "after") => {
    const live = rows.filter((r) => r[key].decision !== "REJECT");
    return live.length ? Math.round((live.reduce((s, r) => s + r[key].rate, 0) / live.length) * 100) / 100 : 0;
  };
  const summary = (key: "before" | "after") => ({
    approve: count(key, "APPROVE"), refer: count(key, "REFER"), reject: count(key, "REJECT"), avgRate: avgRate(key),
  });
  await audit(req, "ruleset.backtest", String(rs._id), null, { version: rs.version, total: rows.length });
  res.json({
    liveVersion: live.version,
    draftVersion: rs.version,
    total: rows.length,
    changed: rows.filter((r) => r.changed).length,
    live: summary("before"),
    draft: summary("after"),
    rows,
  });
});
