import { describe, it, expect } from "vitest";
import { can, invoiceScope, Actor } from "../src/modules/rbac/policy";

const supplier: Actor = { id: "u1", role: "SUPPLIER", entityId: "s1" };
const buyer: Actor = { id: "u2", role: "BUYER", entityId: "b1" };
const approver: Actor = { id: "u3", role: "APPROVER", approvalLimit: 500000 * 100 };
const ops: Actor = { id: "u4", role: "FINANCE_OPS" };
const riskAdmin: Actor = { id: "u5", role: "RISK_ADMIN" };

describe("policy", () => {
  it("blocks permissions the role does not have", () => {
    expect(can(supplier, "invoice:approve")).toEqual({ ok: false, reason: "ROLE_NOT_ALLOWED" });
    expect(can(approver, "disbursement:authorise")).toMatchObject({ ok: false });
  });
  it("scopes suppliers and buyers to their own invoices", () => {
    expect(can(supplier, "invoice:read", { supplierId: "s1" }).ok).toBe(true);
    expect(can(supplier, "invoice:read", { supplierId: "s2" }).ok).toBe(false);
    expect(can(buyer, "invoice:read", { buyerId: "b2" }).ok).toBe(false);
    expect(can(buyer, "invoice:confirm", { buyerId: "b1" }).ok).toBe(true);
    expect(can(buyer, "invoice:confirm", { buyerId: "b2" }).ok).toBe(false);
  });
  it("maker cannot approve their own record", () => {
    expect(can(approver, "invoice:approve", { amount: 100, recommendedBy: "u3" })).toEqual({ ok: false, reason: "MAKER_CHECKER" });
    expect(can(approver, "invoice:approve", { amount: 100, recommendedBy: "u9" }).ok).toBe(true);
  });
  it("enforces approval limits", () => {
    expect(can(approver, "invoice:approve", { amount: 600000 * 100 })).toEqual({ ok: false, reason: "ABOVE_APPROVAL_LIMIT" });
  });
  it("approver cannot disburse their own approval", () => {
    expect(can(ops, "disbursement:initiate", { approvedBy: "u4" })).toEqual({ ok: false, reason: "SEGREGATION_OF_DUTIES" });
    expect(can(ops, "disbursement:authorise", { approvedBy: "u4", initiatedBy: "u9" })).toEqual({ ok: false, reason: "SEGREGATION_OF_DUTIES" });
    expect(can(ops, "disbursement:authorise", { approvedBy: "u3", initiatedBy: "u9" }).ok).toBe(true);
  });
  it("initiator cannot authorise their own payout", () => {
    expect(can(ops, "disbursement:authorise", { approvedBy: "u3", initiatedBy: "u4" })).toEqual({ ok: false, reason: "DUAL_CONTROL" });
  });
  it("rule creator cannot publish", () => {
    expect(can(riskAdmin, "rule:publish", { createdBy: "u5" }).ok).toBe(false);
    expect(can(riskAdmin, "rule:publish", { createdBy: "u6" }).ok).toBe(true);
  });
  it("builds query scopes", () => {
    expect(invoiceScope(supplier)).toEqual({ supplierId: "s1" });
    expect(invoiceScope(buyer)).toEqual({ buyerId: "b1" });
    expect(invoiceScope(ops)).toEqual({});
  });
});
