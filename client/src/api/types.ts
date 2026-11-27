export interface Invoice {
  _id: string
  number: string
  supplierId: string
  buyerId: string
  supplierName?: string
  buyerName?: string
  programId: string
  amount: number
  issueDate: string
  dueDate: string
  status: string
  disputeReason?: string
  advancePercent?: number
  financedAmount?: number
  tenureDays?: number
  recommendation?: 'APPROVE' | 'REJECT'
  recommendedBy?: string
  approvedBy?: string
  createdAt: string
}

export interface InvoiceEvent {
  _id: string
  from?: string
  to: string
  note?: string
  actor?: { name: string } | null
  createdAt: string
}

export interface TraceRow {
  ruleId: string
  type: string
  inputs: Record<string, unknown>
  fired: boolean
}

export interface EngineResult {
  decision: string
  score: number
  rate: number
  advancePercent: number
  fee: number
  reasons: string[]
  trace: TraceRow[]
}

export interface Evaluation {
  ruleSetVersion: number
  result: EngineResult
}

export interface InvoiceDetailResponse {
  invoice: Invoice
  events: InvoiceEvent[]
  evaluation: Evaluation | null
}

export interface Program {
  _id: string
  supplierId: string
  buyerId: string
  supplierName?: string
  buyerName?: string
  sanctioned: number
  outstanding: number
  maxTenureDays: number
  baseRate: number
}

export interface Entity {
  _id: string
  kind: 'SUPPLIER' | 'BUYER'
  legalName: string
  pan?: string
  gstin?: string
  bankAccount?: string
  rating?: string
  vintageMonths?: number
  kycStatus?: string
  kycRemarks?: string
}

export interface Dues {
  penal: number
  fees: number
  interest: number
  principal: number
}

export interface Disbursement {
  _id: string
  invoiceId: { _id: string; number: string; amount: number; supplierId?: { legalName: string }; buyerId?: { legalName: string } } | null
  amount?: number
  net?: number
  status: 'PENDING_AUTH' | 'SUCCESS' | 'FAILED'
  reference?: string
  failureReason?: string
  bankStatus?: 'CONFIRMED' | 'FAILED'
  initiatedBy?: { _id: string; name: string } | null
  authorisedBy?: { _id: string; name: string } | null
  createdAt: string
}

export interface Notification {
  id: string
  at: string
  invoiceId: string
  number?: string
  from?: string
  to: string
  by: string
  note?: string
  unread?: boolean
}

export interface InvoicePage {
  items: Invoice[]
  nextCursor: string | null
}

export type Op = 'eq' | 'gt' | 'lt' | 'between' | 'in' | 'regex'
export type Condition =
  | { fact: string; op: Op; value: unknown }
  | { all: Condition[] }
  | { any: Condition[] }

export interface Rule {
  id: string
  type: 'eligibility' | 'scoring' | 'pricing'
  when: Condition
  then: { decision?: 'APPROVE' | 'REFER' | 'REJECT'; reason?: string; points?: number; rate?: number; fee?: number; advancePercent?: number }
}

export interface PricingConfig {
  baseRate: number
  minFee: number
  feePercent: number
  defaultAdvancePercent: number
  scoreBands: { min: number; premium: number }[]
  tenureSlabs: { upToDays: number; add: number }[]
  approveScore: number
  referScore: number
}

export interface RuleSet {
  _id: string
  version: number
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  rules: Rule[]
  pricing: PricingConfig
  createdBy?: string
  createdByName?: string
  publishedByName?: string
  createdAt: string
}

export interface FactDef { key: string; label: string; kind: 'number' | 'text' | 'boolean' }

interface Outcome { decision: 'APPROVE' | 'REFER' | 'REJECT'; score: number; rate: number }
interface Tally { approve: number; refer: number; reject: number; avgRate: number }

export interface BackTest {
  liveVersion: number
  draftVersion: number
  total: number
  changed: number
  live: Tally
  draft: Tally
  rows: { invoiceId: string; number?: string; amount?: number; before: Outcome; after: Outcome; changed: boolean }[]
}

export interface LedgerRow {
  _id: string
  txId: string
  invoiceId?: string
  invoiceNumber?: string
  account: string
  debit: number
  credit: number
  memo?: string
  reference?: string
  postedOn: string
  reverses?: string
  reversed: boolean
}

export interface LedgerPage {
  items: LedgerRow[]
  total: number
  page: number
  limit: number
  totals: { debit: number; credit: number; difference: number; unbalanced: number }
}

export interface TrialBalance {
  asOf: string | null
  accounts: { account: string; debit: number; credit: number; balance: number }[]
  debit: number
  credit: number
  difference: number
  unbalanced: { txId: string; debit: number; credit: number }[]
}

export interface AccrualList {
  suggestedDate: string
  openPayouts: number
  unearned: number
  runs: { _id: string; date: string; count: number; amount: number; runByName?: string; source: 'MANUAL' | 'SCHEDULE'; createdAt: string }[]
}

export interface AccrualResult { date: string; alreadyRun: boolean; count: number; amount: number }

export interface PeriodRow {
  key: string
  status: 'OPEN' | 'CLOSE_REQUESTED' | 'CLOSED'
  ended: boolean
  entries: number
  debit: number
  credit: number
  requestedBy?: string
  requestedByName?: string
  requestedAt?: string
  closedByName?: string
  closedAt?: string
}

export interface ExceptionRow {
  _id: string
  kind: 'PAYOUT_FAILED' | 'WEBHOOK_PROBLEM'
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  status: 'OPEN' | 'RESOLVED'
  title: string
  detail?: string
  invoiceId?: string
  invoiceNumber?: string
  disbursementId?: string
  owner?: string
  ownerName?: string
  retryDisbursementId?: string
  resolution?: string
  resolvedByName?: string
  resolvedAt?: string
  createdAt: string
}

export interface StatementRow {
  _id: string
  name: string
  lineCount: number
  from: string
  to: string
  matched: number
  unmatched: number
  uploadedByName?: string
  createdAt: string
}

export interface StatementDetail {
  statement: StatementRow
  summary: { lines: number; matched: number; unmatched: number; unmatchedLedger: number }
  lines: { _id: string; date: string; reference?: string; description?: string; amount: number; direction: 'IN' | 'OUT'; status: 'MATCHED' | 'UNMATCHED'; method?: 'REFERENCE' | 'AMOUNT_AND_DATE'; note?: string }[]
  unmatchedLedger: { txId: string; reference: string; postedOn: string; amount: number; invoiceNumber?: string; memo?: string }[]
}

export type AgeBucket = '0-30' | '31-60' | '61-90' | '90+'

export interface OverdueRow {
  id: string
  number: string
  buyer: string
  contact: string | null
  contactEmail: string | null
  amount: number
  dueDate: string
  daysOverdue: number
  bucket: AgeBucket
  lastFollowUp: string | null
  openFollowUps: number
}

export interface Ageing {
  buckets: Record<AgeBucket, { amount: number; count: number }>
  rows: OverdueRow[]
}

export interface FollowUpRow {
  id: string
  invoiceId: string
  number?: string
  channel: 'CALL' | 'EMAIL' | 'VISIT' | 'NOTE'
  note: string
  promisedOn?: string
  promisedAmount?: number
  nextOn?: string
  status: 'OPEN' | 'DONE'
  by: string
  createdAt: string
  doneAt?: string
}

export interface UserRow {
  id: string
  email: string
  name: string
  role: string
  entityId?: string
  entityName?: string
  approvalLimit?: number
  active: boolean
  locked: boolean
  createdAt: string
}

export interface Overview {
  outstanding: number
  outstandingInvoices: number
  suppliers: number
  disbursedThisMonth: number
  disbursedThisMonthCount: number
  overdueRate: number
  averageYield: number
  months: { label: string; paise: number }[]
  statusMix: { label: string; value: number; color: string }[]
  topPrograms: { id: string; buyer: string; supplier: string; sanctioned: number; used: number }[]
  funnel: { label: string; value: number }[]
}
