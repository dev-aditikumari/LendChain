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
