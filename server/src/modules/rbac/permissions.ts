export type Role =
  | "SUPPLIER" | "BUYER" | "ANALYST" | "APPROVER"
  | "FINANCE_OPS" | "COLLECTIONS" | "RISK_ADMIN" | "ADMIN";

export type Permission =
  | "invoice:create" | "invoice:submit" | "invoice:confirm" | "invoice:read"
  | "financing:request" | "credit:review" | "invoice:approve"
  | "disbursement:execute" | "repayment:create" | "repayment:record"
  | "collections:read" | "rule:propose" | "rule:publish" | "program:manage"
  | "entity:verify" | "user:manage" | "audit:read" | "ledger:read";

export const rolePermissions: Record<Role, Permission[]> = {
  SUPPLIER: ["invoice:create", "invoice:submit", "invoice:read", "financing:request"],
  BUYER: ["invoice:read", "invoice:confirm", "repayment:create"],
  ANALYST: ["invoice:read", "credit:review", "entity:verify"],
  APPROVER: ["invoice:read", "invoice:approve"],
  FINANCE_OPS: ["invoice:read", "disbursement:execute", "ledger:read", "repayment:record"],
  COLLECTIONS: ["invoice:read", "collections:read", "repayment:record"],
  RISK_ADMIN: ["rule:propose", "rule:publish", "program:manage"],
  ADMIN: ["user:manage", "audit:read", "ledger:read", "program:manage", "invoice:read"],
};
