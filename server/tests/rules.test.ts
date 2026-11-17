import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { app, as, newInvoice, resetDb, seedWorld, startDb, stopDb } from "./helpers";
import { RuleSet } from "../src/models";
import { publishedRuleSet } from "../src/modules/rules-engine/service";

let w: Awaited<ReturnType<typeof seedWorld>>;

beforeAll(startDb);
afterAll(stopDb);
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
});

async function financed(number: string, days = 45) {
  const id = (await newInvoice(w, number, 50000, days)).body._id;
  await request(app).post(`/invoices/${id}/submit`).set(as(w.tokens.supplier));
  await request(app).post(`/invoices/${id}/confirm`).set(as(w.tokens.buyer));
  const fin = await request(app).post(`/invoices/${id}/financing-requests`).set(as(w.tokens.supplier)).send({});
  return fin.body;
}

const tighter = (live: any) => ({
  pricing: live.pricing,
  rules: [
    { id: "R-TENURE-30", type: "eligibility", when: { fact: "tenureDays", op: "gt", value: 30 }, then: { decision: "REJECT", reason: "TENURE_EXCEEDS_30_DAYS" } },
    ...live.rules.filter((r: any) => r.id !== "R-TENURE-CAP"),
  ],
});

describe("rule sets", () => {
  it("rejects a rule set that the engine could not run", async () => {
    const live = await publishedRuleSet();
    const post = (rules: unknown[], pricing: unknown = live!.pricing) =>
      request(app).post("/rule-sets").set(as(w.tokens.risk1)).send({ rules, pricing });
    const ok = { id: "R-A", type: "scoring", when: { fact: "tenureDays", op: "gt", value: 5 }, then: { points: 5 } };

    expect((await post([{ ...ok, when: { fact: "nope", op: "gt", value: 5 } }])).status).toBe(400);
    expect((await post([{ ...ok, when: { fact: "tenureDays", op: "gt", value: "5" } }])).status).toBe(400);
    expect((await post([{ ...ok, type: "eligibility" }])).status).toBe(400);
    expect((await post([ok, ok])).status).toBe(400);
    expect((await post([ok], { ...(live!.pricing as object), approveScore: 10, referScore: 40 })).status).toBe(400);
    expect((await post([ok])).status).toBe(201);
  });

  it("a published version changes the decision on a new invoice", async () => {
    const before = await financed("R-1");
    expect(before.evaluation.result.decision).not.toBe("REJECT");
    expect(before.evaluation.ruleSetVersion).toBe(1);

    const live = await publishedRuleSet();
    const draft = await request(app).post("/rule-sets").set(as(w.tokens.risk1)).send(tighter(live));
    expect(draft.status).toBe(201);

    const test = await request(app).post(`/rule-sets/${draft.body._id}/simulate`).set(as(w.tokens.risk1));
    expect(test.body.total).toBe(1);
    expect(test.body.changed).toBe(1);
    expect(test.body.rows[0]).toMatchObject({ number: "R-1", before: { decision: before.evaluation.result.decision }, after: { decision: "REJECT" } });

    const own = await request(app).post(`/rule-sets/${draft.body._id}/publish`).set(as(w.tokens.risk1));
    expect(own.status).toBe(403);
    expect(own.body.code).toBe("MAKER_CHECKER");
    const edit = await request(app).put(`/rule-sets/${draft.body._id}`).set(as(w.tokens.risk2)).send(tighter(live));
    expect(edit.status).toBe(403);

    const pub = await request(app).post(`/rule-sets/${draft.body._id}/publish`).set(as(w.tokens.risk2));
    expect(pub.status).toBe(200);
    expect((await RuleSet.findOne({ version: 1 }))!.status).toBe("ARCHIVED");

    const after = await financed("R-2");
    expect(after.evaluation.ruleSetVersion).toBe(2);
    expect(after.evaluation.result.decision).toBe("REJECT");
    expect(after.evaluation.result.reasons).toContain("TENURE_EXCEEDS_30_DAYS");
    expect(after.invoice.status).toBe("REJECTED");
  });

  it("a draft can be edited by its author and discarded, a published set cannot", async () => {
    const live = await publishedRuleSet();
    const draft = await request(app).post("/rule-sets").set(as(w.tokens.risk1)).send(tighter(live));
    const edited = await request(app).put(`/rule-sets/${draft.body._id}`).set(as(w.tokens.risk1)).send({ ...tighter(live), rules: [] });
    expect(edited.status).toBe(200);
    expect(edited.body.rules).toHaveLength(0);

    expect((await request(app).delete(`/rule-sets/${draft.body._id}`).set(as(w.tokens.risk2))).status).toBe(403);
    expect((await request(app).delete(`/rule-sets/${draft.body._id}`).set(as(w.tokens.risk1))).status).toBe(204);

    const second = await request(app).post("/rule-sets").set(as(w.tokens.risk1)).send(tighter(live));
    await request(app).post(`/rule-sets/${second.body._id}/publish`).set(as(w.tokens.risk2));
    const again = await request(app).post(`/rule-sets/${second.body._id}/publish`).set(as(w.tokens.risk2));
    expect(again.status).toBe(409);
    const late = await request(app).put(`/rule-sets/${second.body._id}`).set(as(w.tokens.risk1)).send(tighter(live));
    expect(late.status).toBe(409);
  });

  it("credit staff can read the rules, nobody else can, and only risk admins can change them", async () => {
    await publishedRuleSet();
    expect((await request(app).get("/rule-sets").set(as(w.tokens.analyst))).status).toBe(200);
    expect((await request(app).get("/rule-sets").set(as(w.tokens.approver))).status).toBe(200);
    expect((await request(app).get("/rule-sets").set(as(w.tokens.supplier))).status).toBe(403);
    expect((await request(app).get("/rule-sets").set(as(w.tokens.finance))).status).toBe(403);
    const live = await publishedRuleSet();
    expect((await request(app).post("/rule-sets").set(as(w.tokens.analyst)).send(tighter(live))).status).toBe(403);
  });
});
