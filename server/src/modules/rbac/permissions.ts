export type Role =
  | "SUPPLIER" | "BUYER" | "ANALYST" | "APPROVER"
  | "FINANCE_OPS" | "OPERATIONS" | "ACCOUNTS"
  | "COLLECTIONS" | "RISK_ADMIN" | "ADMIN";

export type Permission =
  | "invoice:create" | "invoice:submit" | "invoice:confirm" | "invoice:read"
  | "financing:request" | "credit:review" | "invoice:approve"
  | "disbursement:initiate" | "disbursement:authorise" | "disbursement:read"
  | "repayment:create" | "repayment:record"
  | "collections:read" | "collections:write" | "portfolio:read" | "rule:propose" | "rule:publish" | "program:manage"
  | "entity:verify" | "user:manage" | "audit:read" | "ledger:read"
  | "reconciliation:read" | "reconciliation:upload" | "exception:resolve" | "journal:post" | "period:close";

export const ROLES: Role[] = [
  "SUPPLIER", "BUYER", "ANALYST", "APPROVER", "FINANCE_OPS",
  "OPERATIONS", "ACCOUNTS", "COLLECTIONS", "RISK_ADMIN", "ADMIN",
];

export const rolePermissions: Record<Role, Permission[]> = {
  SUPPLIER: ["invoice:create", "invoice:submit", "invoice:read", "financing:request"],
  BUYER: ["invoice:read", "invoice:confirm", "repayment:create"],
  ANALYST: ["invoice:read", "credit:review", "entity:verify"],
  APPROVER: ["invoice:read", "invoice:approve", "disbursement:read", "ledger:read", "audit:read"],
  FINANCE_OPS: [
    "invoice:read", "disbursement:initiate", "disbursement:authorise", "disbursement:read",
    "ledger:read", "reconciliation:read", "repayment:record", "audit:read",
  ],
  OPERATIONS: [
    "invoice:read", "exception:resolve", "disbursement:read", "ledger:read",
    "reconciliation:read", "reconciliation:upload", "audit:read",
  ],
  ACCOUNTS: ["ledger:read", "disbursement:read", "reconciliation:read", "journal:post", "period:close"],
  COLLECTIONS: ["invoice:read", "collections:read", "collections:write", "repayment:record", "ledger:read", "audit:read"],
  RISK_ADMIN: ["rule:propose", "rule:publish", "program:manage", "audit:read", "portfolio:read"],
  ADMIN: [
    "user:manage", "audit:read", "ledger:read", "program:manage", "invoice:read",
    "disbursement:read", "reconciliation:read", "portfolio:read",
  ],
};
