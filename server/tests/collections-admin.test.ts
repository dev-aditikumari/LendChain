import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { app, as, disburse, resetDb, seedWorld, startDb, stopDb, toApproved } from "./helpers";
import { AuditLog, FollowUp, Invoice, User } from "../src/models";
import { markOverdue } from "../src/modules/repayments/overdue";

let w: Awaited<ReturnType<typeof seedWorld>>;
let collections: string;

beforeAll(startDb);
afterAll(stopDb);
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
  await User.create({ email: "collections@t.com", name: "collections", role: "COLLECTIONS", passwordHash: await bcrypt.hash("Passw0rd!x", 4) });
  collections = (await request(app).post("/auth/login").send({ email: "collections@t.com", password: "Passw0rd!x" })).body.token;
});

// pays out an invoice, then moves its due date back so it is overdue by `days`
async function overdue(number: string, days: number) {
  const { id } = await toApproved(w, number);
  const { authorise } = await disburse(w, id, `k-${number}`);
  expect(authorise.status).toBe(201);
  await Invoice.updateOne({ _id: id }, { dueDate: new Date(Date.now() - days * 86400000) });
  await markOverdue();
  return id;
}

describe("ageing and follow-ups", () => {
  it("groups overdue invoices into buckets with their real age", async () => {
    await overdue("A-1", 12);
    await overdue("A-2", 71);
    const r = await request(app).get("/collections/ageing").set(as(collections));
    expect(r.status).toBe(200);
    expect(r.body.buckets["0-30"].count).toBe(1);
    expect(r.body.buckets["61-90"].count).toBe(1);
    expect(r.body.buckets["90+"]).toEqual({ amount: 0, count: 0 });
    expect(r.body.rows).toHaveLength(2);
    expect(r.body.rows[0]).toMatchObject({ number: "A-2", daysOverdue: 71, bucket: "61-90", buyer: "Tata Motors" });
  });

  it("only collections may read the ageing", async () => {
    expect((await request(app).get("/collections/ageing").set(as(w.tokens.supplier))).status).toBe(403);
  });

  it("records a follow-up, lists it, and marks it done", async () => {
    const id = await overdue("F-1", 40);
    const next = new Date(Date.now() + 2 * 86400000).toISOString();
    const made = await request(app).post("/collections/follow-ups").set(as(collections))
      .send({ invoiceId: id, channel: "CALL", note: "Buyer will pay on Friday", promisedOn: next, promisedAmount: 100, nextOn: next });
    expect(made.status).toBe(201);

    const open = await request(app).get("/collections/follow-ups?status=OPEN").set(as(collections));
    expect(open.body).toHaveLength(1);
    expect(open.body[0]).toMatchObject({ number: "F-1", channel: "CALL", status: "OPEN" });
    const ageing = await request(app).get("/collections/ageing").set(as(collections));
    expect(ageing.body.rows[0].openFollowUps).toBe(1);

    expect((await request(app).post(`/collections/follow-ups/${made.body._id}/done`).set(as(collections))).status).toBe(200);
    expect((await request(app).post(`/collections/follow-ups/${made.body._id}/done`).set(as(collections))).status).toBe(404);
    expect((await request(app).get("/collections/follow-ups?status=OPEN").set(as(collections))).body).toHaveLength(0);
    expect(await AuditLog.countDocuments({ action: "followup.create" })).toBe(1);
  });

  it("a note without a next date is closed straight away", async () => {
    const id = await overdue("F-2", 5);
    const r = await request(app).post("/collections/follow-ups").set(as(collections)).send({ invoiceId: id, channel: "EMAIL", note: "Sent a reminder" });
    expect(r.body.status).toBe("DONE");
  });

  it("refuses follow-ups on invoices that are not overdue, odd promises, and other roles", async () => {
    const { id } = await toApproved(w, "F-3");
    const send = (body: object, token = collections) => request(app).post("/collections/follow-ups").set(as(token)).send(body);
    expect((await send({ invoiceId: id, channel: "CALL", note: "hello there" })).status).toBe(400);
    const late = await overdue("F-4", 5);
    expect((await send({ invoiceId: late, channel: "CALL", note: "ok" })).status).toBe(400);
    expect((await send({ invoiceId: late, channel: "CALL", note: "promise", promisedAmount: 500 })).status).toBe(400);
    expect((await send({ invoiceId: late, channel: "CALL", note: "hello there" }, w.tokens.finance)).status).toBe(403);
    expect(await FollowUp.countDocuments()).toBe(0);
  });
});

describe("notifications", () => {
  it("counts what is new and clears the count when read", async () => {
    await toApproved(w, "N-1");
    const before = await request(app).get("/notifications/unread").set(as(w.tokens.supplier));
    expect(before.body.count).toBeGreaterThan(0);
    const list = await request(app).get("/notifications").set(as(w.tokens.supplier));
    expect(list.body.some((n: any) => n.unread)).toBe(true);

    await request(app).post("/notifications/read").set(as(w.tokens.supplier));
    expect((await request(app).get("/notifications/unread").set(as(w.tokens.supplier))).body.count).toBe(0);
    expect((await request(app).get("/notifications").set(as(w.tokens.supplier))).body.some((n: any) => n.unread)).toBe(false);
  });

  it("does not count a person's own actions", async () => {
    await request(app).post("/invoices").set(as(w.tokens.supplier)).send({
      number: "N-2", buyerId: String(w.buyer._id), amount: 5000000,
      issueDate: new Date().toISOString(), dueDate: new Date(Date.now() + 40 * 86400000).toISOString(),
    });
    expect((await request(app).get("/notifications/unread").set(as(w.tokens.supplier))).body.count).toBe(0);
  });
});

describe("users", () => {
  const post = (body: object) => request(app).post("/users").set(as(w.tokens.admin)).send(body);

  it("lists users for an admin only", async () => {
    const r = await request(app).get("/users").set(as(w.tokens.admin));
    expect(r.status).toBe(200);
    expect(r.body.length).toBeGreaterThan(10);
    expect(JSON.stringify(r.body)).not.toContain("passwordHash");
    expect((await request(app).get("/users").set(as(w.tokens.analyst))).status).toBe(403);
  });

  it("creates a user, and refuses duplicates, unknown roles and company-less suppliers", async () => {
    const ok = await post({ email: "New@T.com", name: "New Person", password: "longenough1", role: "ANALYST" });
    expect(ok.status).toBe(201);
    expect(ok.body.email).toBe("new@t.com");
    expect((await post({ email: "new@t.com", name: "Again", password: "longenough1", role: "ANALYST" })).status).toBe(409);
    expect((await post({ email: "x@t.com", name: "X Person", password: "longenough1", role: "WIZARD" })).status).toBe(400);
    expect((await post({ email: "y@t.com", name: "Y Person", password: "longenough1", role: "SUPPLIER" })).status).toBe(400);
    expect((await post({ email: "z@t.com", name: "Z Person", password: "longenough1", role: "SUPPLIER", entityId: String(w.supplier._id) })).status).toBe(201);
  });

  it("changing a role or deactivating a user ends their sessions", async () => {
    const id = String(w.users.analyst._id);
    const patch = (body: object) => request(app).patch(`/users/${id}`).set(as(w.tokens.admin)).send(body);
    expect((await request(app).get("/notifications").set(as(w.tokens.analyst))).status).toBe(200);
    expect((await patch({ role: "OPERATIONS" })).body.role).toBe("OPERATIONS");
    expect((await request(app).get("/notifications").set(as(w.tokens.analyst))).status).toBe(401);
    expect((await patch({ active: false })).body.active).toBe(false);
    const login = await request(app).post("/auth/login").send({ email: "analyst@t.com", password: "Passw0rd!x" });
    expect(login.status).toBeGreaterThanOrEqual(401);
    expect(await AuditLog.countDocuments({ action: "user.update" })).toBe(2);
  });

  it("an admin cannot demote or deactivate themselves", async () => {
    const id = String(w.users.admin._id);
    expect((await request(app).patch(`/users/${id}`).set(as(w.tokens.admin)).send({ active: false })).body.code).toBe("OWN_ACCOUNT");
    expect((await request(app).patch(`/users/${id}`).set(as(w.tokens.admin)).send({ role: "ANALYST" })).status).toBe(400);
  });

  it("resets a password and unlocks a locked account", async () => {
    const id = String(w.users.finance3._id);
    await User.updateOne({ _id: id }, { failedLogins: 5, lockedUntil: new Date(Date.now() + 3600000) });
    expect((await request(app).get("/users").set(as(w.tokens.admin))).body.find((u: any) => u.id === id).locked).toBe(true);
    expect((await request(app).post(`/users/${id}/unlock`).set(as(w.tokens.admin))).body.locked).toBe(false);

    expect((await request(app).post(`/users/${id}/password`).set(as(w.tokens.admin)).send({ password: "short" })).status).toBe(400);
    expect((await request(app).post(`/users/${id}/password`).set(as(w.tokens.admin)).send({ password: "brandnew-pass1" })).status).toBe(200);
    expect((await request(app).post("/auth/login").send({ email: "finance3@t.com", password: "brandnew-pass1" })).status).toBe(200);
    expect((await request(app).post("/auth/login").send({ email: "finance3@t.com", password: "Passw0rd!x" })).status).toBe(401);
  });
});

describe("audit log filters", () => {
  it("filters by action prefix and date, and caps the size", async () => {
    await toApproved(w, "L-1");
    const all = await request(app).get("/audit-logs").set(as(w.tokens.admin));
    const invoices = await request(app).get("/audit-logs?action=invoice").set(as(w.tokens.admin));
    expect(invoices.body.length).toBeGreaterThan(0);
    expect(invoices.body.length).toBeLessThan(all.body.length);
    expect(invoices.body.every((a: any) => a.action.startsWith("invoice"))).toBe(true);
    const future = new Date(Date.now() + 86400000).toISOString();
    expect((await request(app).get(`/audit-logs?from=${future}`).set(as(w.tokens.admin))).body).toHaveLength(0);
    expect((await request(app).get("/audit-logs?limit=1").set(as(w.tokens.admin))).body).toHaveLength(1);
    expect((await request(app).get("/audit-logs?limit=9999").set(as(w.tokens.admin))).status).toBe(400);
    expect((await request(app).get("/audit-logs?action=.*").set(as(w.tokens.admin))).body).toHaveLength(0);
  });
});

describe("portfolio overview", () => {
  it("is built from the real book", async () => {
    const empty = await request(app).get("/portfolio/overview").set(as(w.tokens.admin));
    expect(empty.status).toBe(200);
    expect(empty.body).toMatchObject({ outstanding: 0, overdueRate: 0, averageYield: 0, disbursedThisMonth: 0 });
    expect(empty.body.months).toHaveLength(6);

    await overdue("P-1", 10);
    const { id } = await toApproved(w, "P-2");
    expect((await disburse(w, id, "p2")).authorise.status).toBe(201);
    const r = await request(app).get("/portfolio/overview").set(as(w.tokens.admin));
    expect(r.body.outstanding).toBeGreaterThan(0);
    expect(r.body.outstandingInvoices).toBe(2);
    expect(r.body.disbursedThisMonthCount).toBe(2);
    expect(r.body.overdueRate).toBe(50);
    expect(r.body.averageYield).toBeGreaterThan(0);
    expect(r.body.months[5].paise).toBe(r.body.disbursedThisMonth);
    expect(r.body.funnel.map((f: any) => f.label)).toHaveLength(5);
    expect(r.body.funnel[3].value).toBe(2);
    expect(r.body.topPrograms.length).toBeGreaterThan(0);
  });

  it("is closed to roles without the overview", async () => {
    expect((await request(app).get("/portfolio/overview").set(as(w.tokens.supplier))).status).toBe(403);
  });
});
