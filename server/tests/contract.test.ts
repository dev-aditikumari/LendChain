import { describe, it, expect } from "vitest";
import { ROLES, rolePermissions } from "../src/modules/rbac/permissions";

// The client builds its menus and buttons from these names. Changing a role or a
// permission key here should be a deliberate edit to this file and to the client.
const CONTRACT: Record<string, string[]> = {
  SUPPLIER: ["financing:request", "invoice:create", "invoice:read", "invoice:submit"],
  BUYER: ["invoice:confirm", "invoice:read", "repayment:create"],
  ANALYST: ["credit:review", "entity:verify", "invoice:read"],
  APPROVER: ["audit:read", "disbursement:read", "invoice:approve", "invoice:read", "ledger:read"],
  FINANCE_OPS: [
    "audit:read", "disbursement:authorise", "disbursement:initiate", "disbursement:read",
    "invoice:read", "ledger:read", "reconciliation:read", "repayment:record",
  ],
  OPERATIONS: ["audit:read", "disbursement:read", "exception:resolve", "invoice:read", "ledger:read", "reconciliation:read"],
  ACCOUNTS: ["disbursement:read", "journal:post", "ledger:read", "period:close", "reconciliation:read"],
  COLLECTIONS: ["audit:read", "collections:read", "invoice:read", "ledger:read", "repayment:record"],
  RISK_ADMIN: ["audit:read", "program:manage", "rule:propose", "rule:publish"],
  ADMIN: ["audit:read", "disbursement:read", "invoice:read", "ledger:read", "program:manage", "reconciliation:read", "user:manage"],
};

describe("access contract", () => {
  it("has the ten roles", () => {
    expect([...ROLES].sort()).toEqual(Object.keys(CONTRACT).sort());
    expect(Object.keys(rolePermissions).sort()).toEqual(Object.keys(CONTRACT).sort());
  });
  it("gives each role exactly the agreed permission keys", () => {
    for (const role of ROLES) expect([...rolePermissions[role]].sort()).toEqual(CONTRACT[role]);
  });
});
