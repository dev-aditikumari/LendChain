// Runs the whole invoice flow against a fresh in-memory server, using the seeded demo users.
// Usage: npm run e2e
import http from "http";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createApp } from "../src/app";
import { seedDemo } from "../src/seed";
import { markOverdue } from "../src/modules/repayments/overdue";

let base = "";
let failed = 0;

async function call(token: string | null, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as any };
}

function expect(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : `  ${detail}`}`);
  if (!ok) failed++;
}

const DAY = 86400000;
const login = async (who: string) => {
  const r = await call(null, "POST", "/auth/login", { email: `${who}@lendchain.test`, password: "Demo@1234" });
  if (r.status !== 200) throw new Error(`login ${who}: ${r.status}`);
  return r.body.token as string;
};

async function toDisbursed(t: Record<string, string>, buyerId: string, number: string, issue: Date, due: Date) {
  const created = await call(t.supplier, "POST", "/invoices", {
    number, buyerId, amount: 400000 * 100, issueDate: issue.toISOString(), dueDate: due.toISOString(),
  });
  expect(`${number}: supplier creates draft`, created.status === 201, JSON.stringify(created.body));
  const id = created.body._id as string;
  expect(`${number}: buyer cannot see the draft`, (await call(t.buyer, "GET", `/invoices/${id}`)).status === 404);
  await call(t.supplier, "POST", `/invoices/${id}/submit`);
  expect(`${number}: buyer confirms`, (await call(t.buyer, "POST", `/invoices/${id}/confirm`)).status === 200);
  const fin = await call(t.supplier, "POST", `/invoices/${id}/financing-requests`, {});
  expect(`${number}: engine evaluates`, fin.body.invoice?.status === "ENGINE_EVALUATED", JSON.stringify(fin.body));
  expect(`${number}: analyst recommends`, (await call(t.analyst, "POST", `/approvals/${id}/recommend`, { recommendation: "APPROVE", notes: "checked" })).status === 200);
  const own = await call(t.analyst, "POST", `/approvals/${id}/decision`, { decision: "APPROVE", remarks: "self" });
  expect(`${number}: analyst cannot decide`, own.status === 403);
  expect(`${number}: approver approves`, (await call(t.approver, "POST", `/approvals/${id}/decision`, { decision: "APPROVE", remarks: "fine" })).status === 200);

  const init = await call(t.finance, "POST", "/disbursements", { invoiceId: id });
  expect(`${number}: finance queues the payout`, init.status === 201, JSON.stringify(init.body));
  expect(`${number}: queueing twice is refused`, (await call(t.finance, "POST", "/disbursements", { invoiceId: id })).status === 409);
  const url = `/disbursements/${init.body.disbursement._id}/authorise`;
  const self = await call(t.finance, "POST", url, undefined, { "Idempotency-Key": `${number}-self` });
  expect(`${number}: initiator cannot authorise`, self.status === 403 && self.body.code === "DUAL_CONTROL", JSON.stringify(self.body));
  const ok = await call(t.finance2, "POST", url, undefined, { "Idempotency-Key": `${number}-ok` });
  expect(`${number}: second finance user authorises`, ok.status === 201 && ok.body.invoiceStatus === "DISBURSED", JSON.stringify(ok.body));
  const replay = await call(t.finance2, "POST", url, undefined, { "Idempotency-Key": `${number}-ok` });
  expect(`${number}: retry with the same key returns the same result`, replay.status === 200 && replay.body.disbursement._id === ok.body.disbursement._id);
  return id;
}

async function main() {
  const repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = repl.getUri();
  await mongoose.connect(uri);
  await seedDemo(uri);
  const server = http.createServer(createApp());
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://localhost:${(server.address() as any).port}`;

  const names = ["supplier", "buyer", "analyst", "approver", "finance", "finance2", "collections", "admin"];
  const t: Record<string, string> = {};
  for (const n of names) t[n] = await login(n);

  const programs = await call(t.supplier, "GET", "/programs");
  const buyerId = programs.body[0].buyerId as string;
  expect("supplier sees their program", programs.body.length === 1 && programs.body[0].buyerName !== undefined);

  // normal invoice, draft to repaid
  const id = await toDisbursed(t, buyerId, "E2E-1", new Date(Date.now() - DAY), new Date(Date.now() + 45 * DAY));
  const dues = await call(t.buyer, "GET", `/repayments/dues/${id}`);
  const rep = await call(t.buyer, "POST", "/repayments", { invoiceId: id, amount: dues.body.principal, utr: "UTR-E2E-0001" });
  expect("buyer repays in full, invoice is REPAID", rep.status === 201 && rep.body.invoiceStatus === "REPAID", JSON.stringify(rep.body));
  const limit = await call(t.supplier, "GET", `/programs/${programs.body[0]._id}/limit`);
  expect("limit is released after repayment", limit.body.outstanding === 0, JSON.stringify(limit.body));

  // an invoice that runs past its due date
  const id2 = await toDisbursed(t, buyerId, "E2E-2", new Date(Date.now() - 60 * DAY), new Date(Date.now() - 10 * DAY));
  expect("overdue job marks it", (await markOverdue()) === 1);
  const detail = await call(t.supplier, "GET", `/invoices/${id2}`);
  expect("invoice is OVERDUE", detail.body.invoice.status === "OVERDUE");
  const ageing = await call(t.collections, "GET", "/collections/ageing");
  expect("collections sees it in the 0-30 bucket", ageing.body["0-30"] > 0, JSON.stringify(ageing.body));
  const dues2 = await call(t.buyer, "GET", `/repayments/dues/${id2}`);
  const rep2 = await call(t.buyer, "POST", "/repayments", { invoiceId: id2, amount: dues2.body.principal + dues2.body.penal, utr: "UTR-E2E-0002" });
  expect("buyer repays principal and penal, invoice is REPAID", rep2.status === 201 && rep2.body.invoiceStatus === "REPAID", JSON.stringify(rep2.body));

  // an amount above the approver's limit has to escalate
  const big = await call(t.supplier, "POST", "/invoices", {
    number: "E2E-BIG", buyerId, amount: 800000 * 100,
    issueDate: new Date(Date.now() - DAY).toISOString(), dueDate: new Date(Date.now() + 45 * DAY).toISOString(),
  });
  await call(t.supplier, "POST", `/invoices/${big.body._id}/submit`);
  await call(t.buyer, "POST", `/invoices/${big.body._id}/confirm`);
  await call(t.supplier, "POST", `/invoices/${big.body._id}/financing-requests`, {});
  await call(t.analyst, "POST", `/approvals/${big.body._id}/recommend`, { recommendation: "APPROVE", notes: "checked" });
  const over = await call(t.approver, "POST", `/approvals/${big.body._id}/decision`, { decision: "APPROVE", remarks: "try" });
  expect("approver is stopped above their limit", over.status === 403 && over.body.code === "ABOVE_APPROVAL_LIMIT", JSON.stringify(over.body));

  // forbidden actions are real 403s
  expect("supplier cannot read the audit log", (await call(t.supplier, "GET", "/audit-logs")).status === 403);
  expect("buyer cannot create an invoice", (await call(t.buyer, "POST", "/invoices", {})).status === 403);

  // the audit log has the run
  const audit = await call(t.admin, "GET", "/audit-logs");
  const actions = new Set(audit.body.map((a: any) => a.action));
  for (const a of ["invoice.create", "invoice.confirm", "credit.approve", "disbursement.initiate", "disbursement.authorise", "repayment.record"]) {
    expect(`audit log has ${a}`, actions.has(a));
  }

  server.close();
  await mongoose.disconnect();
  await repl.stop();
  console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
