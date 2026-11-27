import { describe, it, expect } from "vitest";
import { ROLES, rolePermissions } from "../src/modules/rbac/permissions";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";

// the client file is plain text here so the server build does not depend on client sources
const clientRoles = readFileSync(fileURLToPath(new URL("../../client/src/lib/serverRoles.ts", import.meta.url)), "utf8");
const listed = [...clientRoles.match(/SERVER_ROLES = \[([\s\S]*?)\]/)![1].matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
const keyMap = Object.fromEntries([...clientRoles.match(/ROLE_KEY = \{([\s\S]*?)\}/)![1].matchAll(/([A-Z_]+): '([a-z]+)'/g)].map((m) => [m[1], m[2]]));

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
  OPERATIONS: ["audit:read", "disbursement:read", "exception:resolve", "invoice:read", "ledger:read", "reconciliation:read", "reconciliation:upload"],
  ACCOUNTS: ["disbursement:read", "journal:post", "ledger:read", "period:close", "reconciliation:read"],
  COLLECTIONS: ["audit:read", "collections:read", "collections:write", "invoice:read", "ledger:read", "repayment:record"],
  RISK_ADMIN: ["audit:read", "portfolio:read", "program:manage", "rule:propose", "rule:publish"],
  ADMIN: ["audit:read", "disbursement:read", "invoice:read", "ledger:read", "portfolio:read", "program:manage", "reconciliation:read", "user:manage"],
};

describe("access contract", () => {
  it("has the ten roles", () => {
    expect([...ROLES].sort()).toEqual(Object.keys(CONTRACT).sort());
    expect(Object.keys(rolePermissions).sort()).toEqual(Object.keys(CONTRACT).sort());
  });
  it("gives each role exactly the agreed permission keys", () => {
    for (const role of ROLES) expect([...rolePermissions[role]].sort()).toEqual(CONTRACT[role]);
  });
  it("matches the role list the client uses", () => {
    expect([...listed].sort()).toEqual([...ROLES].sort());
    expect(Object.keys(keyMap).sort()).toEqual([...ROLES].sort());
    expect(new Set(Object.values(keyMap)).size).toBe(ROLES.length);
  });
});
