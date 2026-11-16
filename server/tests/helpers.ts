import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createApp } from "../src/app";
import { Entity, Program, User } from "../src/models";

let repl: MongoMemoryReplSet;
export const app = createApp();

export async function startDb() {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(repl.getUri());
  await mongoose.connection.syncIndexes?.();
}

export async function stopDb() {
  await mongoose.disconnect();
  await repl.stop();
}

export async function resetDb() {
  const cols = await mongoose.connection.db!.collections();
  for (const c of cols) await c.deleteMany({});
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
}

const PASSWORD = "Passw0rd!x";

export async function seedWorld(sanctioned = 100000 * 100) {
  const supplier = await Entity.create({ kind: "SUPPLIER", legalName: "Sharma Components", pan: "ABCDE1234F", gstin: "27ABCDE1234F1Z5", vintageMonths: 24, kycStatus: "VERIFIED" });
  const supplier2 = await Entity.create({ kind: "SUPPLIER", legalName: "Rao Textiles", pan: "ABCDE1234G", gstin: "27ABCDE1234G1Z5", vintageMonths: 24, kycStatus: "VERIFIED" });
  const buyer = await Entity.create({ kind: "BUYER", legalName: "Tata Motors", pan: "AAACT1234B", gstin: "27AAACT1234B1Z5", rating: "AA", kycStatus: "VERIFIED" });
  const program = await Program.create({ supplierId: supplier._id, buyerId: buyer._id, sanctioned });
  await Program.create({ supplierId: supplier2._id, buyerId: buyer._id, sanctioned });

  const hash = await bcrypt.hash(PASSWORD, 4);
  const mk = (email: string, role: string, extra: object = {}) => User.create({ email, name: email.split("@")[0], role, passwordHash: hash, ...extra });
  const users = {
    supplier: await mk("supplier@t.com", "SUPPLIER", { entityId: supplier._id }),
    supplier2: await mk("supplier2@t.com", "SUPPLIER", { entityId: supplier2._id }),
    buyer: await mk("buyer@t.com", "BUYER", { entityId: buyer._id }),
    analyst: await mk("analyst@t.com", "ANALYST"),
    approver: await mk("approver@t.com", "APPROVER", { approvalLimit: 500000 * 100 }),
    ops: await mk("ops@t.com", "FINANCE_OPS"),
    risk1: await mk("risk1@t.com", "RISK_ADMIN"),
    risk2: await mk("risk2@t.com", "RISK_ADMIN"),
    admin: await mk("admin@t.com", "ADMIN"),
  };
  const tokens: Record<string, string> = {};
  for (const [k, u] of Object.entries(users)) {
    const r = await request(app).post("/auth/login").send({ email: u.email, password: PASSWORD });
    tokens[k] = r.body.token;
  }
  return { supplier, supplier2, buyer, program, users, tokens };
}

export const as = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function newInvoice(w: Awaited<ReturnType<typeof seedWorld>>, number: string, rupees = 50000, days = 45) {
  const r = await request(app).post("/invoices").set(as(w.tokens.supplier)).send({
    number, buyerId: String(w.buyer._id), amount: rupees * 100,
    issueDate: new Date().toISOString(), dueDate: new Date(Date.now() + days * 86400000).toISOString(),
  });
  return r;
}

export async function toApproved(w: Awaited<ReturnType<typeof seedWorld>>, number: string, rupees = 50000) {
  const id = (await newInvoice(w, number, rupees)).body._id;
  await request(app).post(`/invoices/${id}/submit`).set(as(w.tokens.supplier));
  await request(app).post(`/invoices/${id}/confirm`).set(as(w.tokens.buyer));
  const fin = await request(app).post(`/invoices/${id}/financing-requests`).set(as(w.tokens.supplier)).send({});
  await request(app).post(`/approvals/${id}/recommend`).set(as(w.tokens.analyst)).send({ recommendation: "APPROVE", notes: "looks fine" });
  const dec = await request(app).post(`/approvals/${id}/decision`).set(as(w.tokens.approver)).send({ decision: "APPROVE", remarks: "approved" });
  return { id, fin, dec };
}
