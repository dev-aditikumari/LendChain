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
