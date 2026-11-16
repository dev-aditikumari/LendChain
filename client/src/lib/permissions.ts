export const ROLES = [
  'supplier', 'buyer', 'analyst', 'approver', 'finance', 'ops', 'accounts', 'collections', 'risk', 'admin',
] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABEL: Record<Role, string> = {
  supplier: 'Supplier',
  buyer: 'Buyer',
  analyst: 'Analyst',
  approver: 'Approver',
  finance: 'Finance Ops',
  ops: 'Operations',
  accounts: 'Accounts',
  collections: 'Collections',
  risk: 'Risk Admin',
  admin: 'Admin',
}

export const ROLE_SHORT: Record<Role, string> = {
  supplier: 'Sup', buyer: 'Buy', analyst: 'Ana', approver: 'App', finance: 'Fin',
  ops: 'Ops', accounts: 'Acc', collections: 'Col', risk: 'Rsk', admin: 'Adm',
}

// roles that sign in with a second step
export const INTERNAL_ROLES: Role[] = ROLES.filter((r) => r !== 'supplier' && r !== 'buyer')

// ● full, ○ view only, – none
export type Level = 'full' | 'view' | 'none'

const L: Record<string, Level> = { '●': 'full', '○': 'view', '–': 'none' }

function parse(rows: Record<string, string>): Record<string, Record<Role, Level>> {
  const out: Record<string, Record<Role, Level>> = {}
  for (const [name, cells] of Object.entries(rows)) {
    const marks = cells.replace(/\s/g, '').split('')
    out[name] = Object.fromEntries(ROLES.map((r, i) => [r, L[marks[i]]])) as Record<Role, Level>
  }
  return out
}

export const ACTIONS = parse({
  'Create invoice': '●–––––––––',
  'Confirm / dispute': '–●––––––––',
  'Recommend decision': '––●–––––––',
  'Approve within limit': '–––●––––––',
  'Execute disbursement': '––––●–––––',
  'Resolve exceptions': '–––––●––––',
  'Post journals / close': '––––––●–––',
  'Record repayment': '–●––●–––––',
  'Follow up overdue': '–––––––●––',
  'Publish rule set': '––––––––●●',
  'Manage users and roles': '–––––––––●',
  'View audit log': '–––○○○–○○●',
})

export const SECTIONS = parse({
  'Dashboard': '●●●●●●●●●●',
  'Invoices': '●●○–○○––○○',
  'Financing': '●○–––○––○–',
  'Approvals': '––○●●○–––○',
  'Disbursement': '–––○●●○––○',
  'Ledger': '–––○●●●○–○',
  'Reconciliation': '–––○●●○––○',
  'Exceptions': '–––○–●–––○',
  'Trial balance / close': '–––––○●––○',
  'Collections': '○○––○––●–○',
  'Rule engine': '––○○––––●●',
  'Audit log': '–––○○○–○○●',
  'Users and roles': '–––––––––●',
})

export type Section = keyof typeof SECTIONS
export type Action = keyof typeof ACTIONS

export function sectionLevel(role: Role, section: string): Level {
  return SECTIONS[section]?.[role] ?? 'none'
}

export function actionLevel(role: Role, action: string): Level {
  return ACTIONS[action]?.[role] ?? 'none'
}

export interface NavItem {
  label: string
  to: string
  section: Section
}

const n = (label: string, to: string, section: Section): NavItem => ({ label, to, section })

// menu per role, each entry gated by the section visibility matrix
export const NAV: Record<Role, NavItem[]> = {
  supplier: [
    n('Dashboard', '/dashboard', 'Dashboard'),
    n('Invoices', '/invoices/new', 'Invoices'),
    n('Financing', '/financing', 'Financing'),
    n('Repayments', '/p/repayments', 'Invoices'),
    n('Onboarding', '/onboarding', 'Dashboard'),
    n('Notifications', '/notifications', 'Dashboard'),
  ],
  buyer: [
    n('Inbox', '/inbox', 'Invoices'),
    n('Payables', '/p/payables', 'Invoices'),
    n('Repayments', '/p/repayments', 'Invoices'),
    n('Disputes', '/disputes', 'Invoices'),
  ],
  analyst: [
    n('Queue', '/queue', 'Approvals'),
    n('KYC checks', '/p/kyc-checks', 'Approvals'),
    n('Decisions', '/p/decisions', 'Approvals'),
  ],
  approver: [
    n('Queue', '/review', 'Approvals'),
    n('Approved', '/p/approved', 'Approvals'),
    n('Rejected', '/p/rejected', 'Approvals'),
    n('Limits', '/p/limits', 'Approvals'),
  ],
  finance: [
    n('Disbursements', '/disbursements', 'Disbursement'),
    n('Ledger', '/ledger', 'Ledger'),
    n('Reconciliation', '/reconciliation', 'Reconciliation'),
  ],
  ops: [
    n('Exceptions', '/exceptions', 'Exceptions'),
    n('Payout monitor', '/p/payout-monitor', 'Disbursement'),
    n('Reconciliation', '/reconciliation', 'Reconciliation'),
    n('Master data', '/p/master-data', 'Invoices'),
  ],
  accounts: [
    n('Trial balance', '/trial-balance', 'Trial balance / close'),
    n('Accruals', '/accruals', 'Trial balance / close'),
    n('Settlements', '/p/settlements', 'Disbursement'),
    n('Period close', '/period-close', 'Trial balance / close'),
    n('Tax & GST', '/p/tax-gst', 'Ledger'),
  ],
  collections: [
    n('Ageing', '/ageing', 'Collections'),
    n('Follow-ups', '/p/follow-ups', 'Collections'),
    n('Overdue', '/p/overdue', 'Collections'),
  ],
  risk: [
    n('Rule sets', '/rules', 'Rule engine'),
    n('Pricing grids', '/pricing', 'Rule engine'),
    n('Limits', '/p/limits', 'Financing'),
  ],
  admin: [
    n('Overview', '/overview', 'Dashboard'),
    n('Users & roles', '/users', 'Users and roles'),
    n('Access map', '/access', 'Users and roles'),
    n('Programs', '/programs', 'Dashboard'),
    n('Audit log', '/audit', 'Audit log'),
    n('Settings', '/p/settings', 'Dashboard'),
  ],
}

export function navFor(role: Role): NavItem[] {
  return NAV[role].filter((i) => sectionLevel(role, i.section) !== 'none')
}

export const HOME: Record<Role, string> = {
  supplier: '/dashboard',
  buyer: '/inbox',
  analyst: '/queue',
  approver: '/review',
  finance: '/disbursements',
  ops: '/exceptions',
  accounts: '/trial-balance',
  collections: '/ageing',
  risk: '/rules',
  admin: '/overview',
}
