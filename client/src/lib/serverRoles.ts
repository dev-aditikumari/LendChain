// Role names as the API sends them, and the short keys the screens use.
// server/tests/contract.test.ts compares this list with the server's roles.
export const SERVER_ROLES = [
  'SUPPLIER', 'BUYER', 'ANALYST', 'APPROVER', 'FINANCE_OPS',
  'OPERATIONS', 'ACCOUNTS', 'COLLECTIONS', 'RISK_ADMIN', 'ADMIN',
] as const

export type ServerRole = (typeof SERVER_ROLES)[number]

export const ROLE_KEY = {
  SUPPLIER: 'supplier',
  BUYER: 'buyer',
  ANALYST: 'analyst',
  APPROVER: 'approver',
  FINANCE_OPS: 'finance',
  OPERATIONS: 'ops',
  ACCOUNTS: 'accounts',
  COLLECTIONS: 'collections',
  RISK_ADMIN: 'risk',
  ADMIN: 'admin',
} as const satisfies Record<ServerRole, string>
