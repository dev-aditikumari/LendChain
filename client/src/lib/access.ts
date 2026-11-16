import { type Level, type Role } from './permissions'
import { ROLE_KEY, type ServerRole } from './serverRoles'

// The server decides which actions a role may take. A screen section is shown in
// full when the user holds a "full" key and read-only when they hold a "view" key.
// Which keys count is a presentation choice, so it is the only mapping kept here.
interface SectionRule { full: string[]; view: string[] }

export const SECTION_RULES: Record<string, SectionRule> = {
  'Invoices': { full: ['invoice:create', 'invoice:confirm'], view: ['invoice:read'] },
  'Financing': { full: ['financing:request'], view: ['program:manage'] },
  'Approvals': { full: ['invoice:approve', 'disbursement:authorise'], view: ['credit:review'] },
  'Disbursement': { full: ['disbursement:initiate'], view: ['disbursement:read'] },
  'Ledger': { full: ['journal:post', 'disbursement:initiate'], view: ['ledger:read'] },
  'Reconciliation': { full: ['exception:resolve', 'disbursement:initiate'], view: ['reconciliation:read'] },
  'Exceptions': { full: ['exception:resolve'], view: ['disbursement:read'] },
  'Trial balance / close': { full: ['journal:post', 'period:close'], view: ['reconciliation:read'] },
  'Collections': { full: ['collections:read'], view: ['repayment:record', 'repayment:create'] },
  'Rule engine': { full: ['rule:publish'], view: ['credit:review', 'invoice:approve'] },
  'Audit log': { full: ['user:manage'], view: ['audit:read'] },
  'Users and roles': { full: ['user:manage'], view: [] },
}

export const SECTION_NAMES = ['Dashboard', ...Object.keys(SECTION_RULES)]

export function sectionLevel(permissions: string[], section: string): Level {
  if (section === 'Dashboard') return 'full'
  const rule = SECTION_RULES[section]
  if (!rule) return 'none'
  if (rule.full.some((k) => permissions.includes(k))) return 'full'
  if (rule.view.some((k) => permissions.includes(k))) return 'view'
  return 'none'
}

// rows of the role matrix: label shown on screen and the server key behind it
export const ACTION_ROWS: { label: string; key: string }[] = [
  { label: 'Create invoice', key: 'invoice:create' },
  { label: 'Confirm / dispute', key: 'invoice:confirm' },
  { label: 'Recommend decision', key: 'credit:review' },
  { label: 'Approve within limit', key: 'invoice:approve' },
  { label: 'Initiate disbursement', key: 'disbursement:initiate' },
  { label: 'Authorise disbursement', key: 'disbursement:authorise' },
  { label: 'Resolve exceptions', key: 'exception:resolve' },
  { label: 'Post journals', key: 'journal:post' },
  { label: 'Close period', key: 'period:close' },
  { label: 'Record repayment', key: 'repayment:record' },
  { label: 'Follow up overdue', key: 'collections:read' },
  { label: 'Publish rule set', key: 'rule:publish' },
  { label: 'Manage users and roles', key: 'user:manage' },
  { label: 'View audit log', key: 'audit:read' },
]

type RoleTable = Record<ServerRole, string[]>

function byRole<T>(table: RoleTable, cell: (perms: string[], role: Role) => T): Record<Role, T> {
  return Object.fromEntries(
    (Object.keys(ROLE_KEY) as ServerRole[]).map((r) => [ROLE_KEY[r], cell(table[r] ?? [], ROLE_KEY[r])]),
  ) as Record<Role, T>
}

export function actionMatrix(table: RoleTable): Record<string, Record<Role, Level>> {
  return Object.fromEntries(
    ACTION_ROWS.map(({ label, key }) => [label, byRole(table, (p): Level => (p.includes(key) ? 'full' : 'none'))]),
  )
}

export function sectionMatrix(table: RoleTable): Record<string, Record<Role, Level>> {
  return Object.fromEntries(SECTION_NAMES.map((s) => [s, byRole(table, (p) => sectionLevel(p, s))]))
}

