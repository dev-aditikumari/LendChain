import type { PillKind } from '../components/StatusPill'

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  BUYER_CONFIRMED: 'Buyer confirmed',
  FINANCING_REQUESTED: 'Financing requested',
  ENGINE_EVALUATED: 'Under review',
  APPROVED: 'Approved',
  DISBURSED: 'Disbursed',
  REPAID: 'Repaid',
  CLOSED: 'Closed',
  DISPUTED: 'Disputed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  OVERDUE: 'Overdue',
  WRITTEN_OFF: 'Written off',
}

const KIND: Record<string, PillKind> = {
  DRAFT: 'neutral', SUBMITTED: 'warning', BUYER_CONFIRMED: 'info', FINANCING_REQUESTED: 'warning',
  ENGINE_EVALUATED: 'warning', APPROVED: 'info', DISBURSED: 'success', REPAID: 'success', CLOSED: 'neutral',
  DISPUTED: 'danger', REJECTED: 'danger', CANCELLED: 'neutral', OVERDUE: 'danger', WRITTEN_OFF: 'danger',
}

export const statusLabel = (s: string) => STATUS_LABEL[s] ?? s
export const statusKind = (s: string): PillKind => KIND[s] ?? 'neutral'

// the happy path shown in the stepper
export const PATH = [
  'DRAFT', 'SUBMITTED', 'BUYER_CONFIRMED', 'FINANCING_REQUESTED', 'ENGINE_EVALUATED', 'APPROVED', 'DISBURSED',
]
export const PATH_LABELS = PATH.map(statusLabel)

// index of the current step; past the last step means everything is complete
export function stepIndex(status: string): number {
  const i = PATH.indexOf(status)
  if (i >= 0) return i
  if (status === 'REPAID' || status === 'CLOSED') return PATH.length
  if (status === 'OVERDUE') return PATH.length - 1
  return 0
}
