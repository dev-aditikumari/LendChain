import type { PillKind } from '../components/StatusPill'

export type Row = Record<string, string | number>

export interface Invoice {
  id: string
  buyer: string
  amount: number
  due: string
  status: string
  kind: PillKind
}

export const LEDGER: Row[] = [
  { id: 'JE-9031', date: '15 Nov', account: 'Receivable: Tata Auto Parts', debit: 1850000, credit: 0 },
  { id: 'JE-9031', date: '15 Nov', account: 'Payable: Kaveri Components', debit: 0, credit: 1665000 },
  { id: 'JE-9031', date: '15 Nov', account: 'Discount income', debit: 0, credit: 185000 },
  { id: 'JE-9030', date: '14 Nov', account: 'Bank: HDFC escrow', debit: 828000, credit: 0 },
  { id: 'JE-9030', date: '14 Nov', account: 'Receivable: Mahindra Logistics', debit: 0, credit: 828000 },
  { id: 'JE-9029', date: '13 Nov', account: 'Fee income', debit: 0, credit: 12400 },
  { id: 'JE-9029', date: '13 Nov', account: 'Bank: HDFC escrow', debit: 12400, credit: 0 },
]

export const EXCEPTIONS: Row[] = [
  { id: 'EXC-301', type: 'Payout bounced', record: 'DSB-5512', severity: 'High', owner: 'Unassigned' },
  { id: 'EXC-298', type: 'Duplicate invoice number', record: 'INV-2050', severity: 'Medium', owner: 'Sana Qureshi' },
  { id: 'EXC-295', type: 'Bank line unmatched', record: 'UTR 4421908', severity: 'Medium', owner: 'Unassigned' },
  { id: 'EXC-290', type: 'Missing buyer GSTIN', record: 'Sunrise Plastics', severity: 'Low', owner: 'Sana Qureshi' },
]

export const RECON: Row[] = [
  { utr: 'UTR 4421901', bank: 828000, ledger: 828000, status: 'Matched' },
  { utr: 'UTR 4421902', bank: 576000, ledger: 576000, status: 'Matched' },
  { utr: 'UTR 4421908', bank: 412000, ledger: 0, status: 'Unmatched' },
  { utr: 'UTR 4421910', bank: 0, ledger: 150000, status: 'Unmatched' },
  { utr: 'UTR 4421915', bank: 1260000, ledger: 1260000, status: 'Matched' },
]

export const TRIAL_BALANCE: Row[] = [
  { code: '1010', account: 'Bank: HDFC escrow', debit: 9420000, credit: 0 },
  { code: '1200', account: 'Receivables from buyers', debit: 21840000, credit: 0 },
  { code: '2100', account: 'Payable to suppliers', debit: 0, credit: 4260000 },
  { code: '2200', account: 'Lender funding', debit: 0, credit: 24100000 },
  { code: '4100', account: 'Discount income', debit: 0, credit: 2480000 },
  { code: '4200', account: 'Fee income', debit: 0, credit: 420000 },
]

export const ACCRUALS: Row[] = [
  { run: 'ACR-1106', period: 'Nov 2026', invoices: 214, amount: 482000, status: 'Pending' },
  { run: 'ACR-1005', period: 'Oct 2026', invoices: 198, amount: 436500, status: 'Posted' },
  { run: 'ACR-0904', period: 'Sep 2026', invoices: 181, amount: 401200, status: 'Posted' },
]

export const CLOSE_CHECKS: Row[] = [
  { item: 'All accrual runs posted', owner: 'Farah Sheikh', status: 'Done' },
  { item: 'Bank reconciliation complete', owner: 'Sana Qureshi', status: 'Done' },
  { item: 'Trial balance difference is zero', owner: 'Farah Sheikh', status: 'Done' },
  { item: 'Tax and GST journals reviewed', owner: 'Farah Sheikh', status: 'Pending' },
  { item: 'Second sign-off', owner: 'Ishita Verma', status: 'Pending' },
]

export const OVERDUE: Row[] = [
  { id: 'INV-1987', buyer: 'Bharat Forge', amount: 720000, days: 12, bucket: '0-30', contact: 'Anil Kapoor' },
  { id: 'INV-1962', buyer: 'Mahindra Logistics', amount: 1380000, days: 38, bucket: '31-60', contact: 'Rekha Pillai' },
  { id: 'INV-1930', buyer: 'Lotus Textiles', amount: 540000, days: 71, bucket: '61-90', contact: 'Sameer Shah' },
  { id: 'INV-1884', buyer: 'Deccan Packaging', amount: 310000, days: 104, bucket: '90+', contact: 'Neha Gupta' },
]

export const DISBURSEMENT_MONTHS = [
  { label: 'Jun', value: 4.2 },
  { label: 'Jul', value: 5.1 },
  { label: 'Aug', value: 4.8 },
  { label: 'Sep', value: 6.3 },
  { label: 'Oct', value: 7.0 },
  { label: 'Nov', value: 8.4 },
]

export const STATUS_MIX = [
  { label: 'Disbursed', value: 46, color: '#6D4AFF' },
  { label: 'Approved', value: 22, color: '#FFC94D' },
  { label: 'Under review', value: 18, color: '#3447B8' },
  { label: 'Repaid', value: 14, color: '#CDBFFF' },
]

export const TOP_PROGRAMS: Row[] = [
  { program: 'Tata Auto Parts', suppliers: 38, limit: 120000000, used: 81000000 },
  { program: 'Mahindra Logistics', suppliers: 24, limit: 80000000, used: 71200000 },
  { program: 'Bharat Forge', suppliers: 17, limit: 50000000, used: 21500000 },
  { program: 'Lotus Textiles', suppliers: 12, limit: 30000000, used: 28100000 },
]

export const FUNNEL = [
  { label: 'Invoices submitted', value: 1420 },
  { label: 'Buyer confirmed', value: 1210 },
  { label: 'Approved', value: 1040 },
  { label: 'Disbursed', value: 986 },
  { label: 'Repaid', value: 812 },
]
