import type { Role } from '../lib/permissions'
import type { PillKind } from '../components/StatusPill'

export type Row = Record<string, string | number>

export interface DemoUser {
  email: string
  name: string
  role: Role
  company: string
}

const d = (email: string, name: string, role: Role, company: string): DemoUser => ({
  email: `${email}@lendchain.test`, name, role, company,
})

export const DEMO_USERS: DemoUser[] = [
  d('supplier', 'Meera Iyer', 'supplier', 'Kaveri Components'),
  d('buyer', 'Rohan Desai', 'buyer', 'Tata Auto Parts Ltd'),
  d('analyst', 'Kavya Nair', 'analyst', 'LendChain'),
  d('approver', 'Arjun Menon', 'approver', 'LendChain'),
  d('ops', 'Sana Qureshi', 'ops', 'LendChain'),
  d('collections', 'Vikram Rao', 'collections', 'LendChain'),
  d('risk1', 'Pooja Bansal', 'risk', 'LendChain'),
  d('risk2', 'Dev Malhotra', 'risk', 'LendChain'),
  d('admin', 'Ishita Verma', 'admin', 'LendChain'),
  d('finance', 'Nikhil Joshi', 'finance', 'LendChain'),
  d('accounts', 'Farah Sheikh', 'accounts', 'LendChain'),
]

export const ROLE_PREVIEW: Record<Role, string> = {
  supplier: 'supplier@lendchain.test',
  buyer: 'buyer@lendchain.test',
  analyst: 'analyst@lendchain.test',
  approver: 'approver@lendchain.test',
  finance: 'finance@lendchain.test',
  ops: 'ops@lendchain.test',
  accounts: 'accounts@lendchain.test',
  collections: 'collections@lendchain.test',
  risk: 'risk1@lendchain.test',
  admin: 'admin@lendchain.test',
}

export const INVOICE_STATES = [
  'Draft', 'Submitted', 'Buyer confirmed', 'Financing requested', 'Engine evaluated', 'Approved', 'Disbursed',
]

export interface Invoice {
  id: string
  buyer: string
  amount: number
  due: string
  status: string
  kind: PillKind
}

export const SUPPLIER_INVOICES: Invoice[] = [
  { id: 'INV-2041', buyer: 'Tata Auto Parts Ltd', amount: 1850000, due: '28 Nov 2026', status: 'Approved', kind: 'info' },
  { id: 'INV-2038', buyer: 'Mahindra Logistics', amount: 920000, due: '22 Nov 2026', status: 'Disbursed', kind: 'success' },
  { id: 'INV-2036', buyer: 'Tata Auto Parts Ltd', amount: 2400000, due: '05 Dec 2026', status: 'Under review', kind: 'warning' },
  { id: 'INV-2031', buyer: 'Bharat Forge', amount: 640000, due: '19 Nov 2026', status: 'Disbursed', kind: 'success' },
  { id: 'INV-2027', buyer: 'Mahindra Logistics', amount: 1120000, due: '12 Dec 2026', status: 'Buyer confirmed', kind: 'info' },
  { id: 'INV-2019', buyer: 'Bharat Forge', amount: 380000, due: '30 Nov 2026', status: 'Disputed', kind: 'danger' },
]

export const INVOICE_TIMELINE = [
  { event: 'Invoice submitted', detail: '02 Nov 2026, 10:14 by Meera Iyer' },
  { event: 'Buyer confirmed', detail: '03 Nov 2026, 16:40 by Rohan Desai' },
  { event: 'Financing requested', detail: '04 Nov 2026, 09:05, advance 90%, 45 days' },
  { event: 'Rule engine evaluated', detail: 'Score 742, rule set v14, risk band B' },
  { event: 'Recommended by analyst', detail: '05 Nov 2026, 11:30 by Kavya Nair' },
  { event: 'Approved', detail: '06 Nov 2026, 14:12 by Arjun Menon' },
]

export const SUPPLIER_DOCS: Row[] = [
  { name: 'Invoice PDF', file: 'INV-2041.pdf', status: 'Verified' },
  { name: 'Purchase order', file: 'PO-88213.pdf', status: 'Verified' },
  { name: 'Delivery challan', file: 'DC-5521.pdf', status: 'Under review' },
]

export const KYC_DOCS: Row[] = [
  { doc: 'Certificate of incorporation', uploaded: '14 Oct 2026', status: 'Verified' },
  { doc: 'PAN card', uploaded: '14 Oct 2026', status: 'Verified' },
  { doc: 'GST registration', uploaded: '15 Oct 2026', status: 'Under review' },
  { doc: 'Bank statement (6 months)', uploaded: '-', status: 'Not uploaded' },
  { doc: 'Board resolution', uploaded: '-', status: 'Not uploaded' },
]

export const BUYER_INBOX: Row[] = [
  { id: 'INV-2041', supplier: 'Kaveri Components', amount: 1850000, due: '28 Nov 2026', status: 'Awaiting you' },
  { id: 'INV-2036', supplier: 'Kaveri Components', amount: 2400000, due: '05 Dec 2026', status: 'Awaiting you' },
  { id: 'INV-2044', supplier: 'Sunrise Plastics', amount: 760000, due: '10 Dec 2026', status: 'Awaiting you' },
  { id: 'INV-2019', supplier: 'Kaveri Components', amount: 380000, due: '30 Nov 2026', status: 'Disputed' },
  { id: 'INV-2038', supplier: 'Kaveri Components', amount: 920000, due: '22 Nov 2026', status: 'Confirmed' },
]

export const DISPUTE_MESSAGES = [
  { id: 1, from: 'Rohan Desai', own: false, text: 'The delivered quantity was 480 units, the invoice says 500. Please correct the amount.', time: '08 Nov, 10:20' },
  { id: 2, from: 'Meera Iyer', own: true, text: 'Checking the challan. The remaining 20 units shipped on 4 Nov in a separate truck.', time: '08 Nov, 12:05' },
  { id: 3, from: 'Rohan Desai', own: false, text: 'We did not receive that truck at the gate. Can you share the lorry receipt?', time: '09 Nov, 09:41' },
  { id: 4, from: 'Meera Iyer', own: true, text: 'Uploading the lorry receipt now.', time: '09 Nov, 11:15' },
]

export const ANALYST_QUEUE: Row[] = [
  { id: 'INV-2036', supplier: 'Kaveri Components', amount: 2400000, engine: 'Refer', sla: '3h left' },
  { id: 'INV-2044', supplier: 'Sunrise Plastics', amount: 760000, engine: 'Pass', sla: '6h left' },
  { id: 'INV-2046', supplier: 'Lotus Textiles', amount: 3150000, engine: 'Refer', sla: 'Overdue' },
  { id: 'INV-2047', supplier: 'Deccan Packaging', amount: 540000, engine: 'Pass', sla: '1d left' },
  { id: 'INV-2049', supplier: 'Orbit Castings', amount: 1980000, engine: 'Fail', sla: '5h left' },
]

export const ENGINE_TRACE: Row[] = [
  { rule: 'Buyer confirmed', detail: 'Confirmed on 03 Nov 2026', result: 'Pass' },
  { rule: 'Supplier KYC status', detail: 'Verified, valid to Mar 2027', result: 'Pass' },
  { rule: 'Program limit headroom', detail: '₹18.0 L of ₹20.0 L used after this invoice', result: '+10' },
  { rule: 'Buyer concentration', detail: '41% of supplier book, cap 45%', result: '-5' },
  { rule: 'Tenure within policy', detail: '45 days, max 90', result: 'Pass' },
  { rule: 'Past repayment behaviour', detail: '0 late payments in 12 months', result: '+25' },
]

export const DISBURSEMENTS: Row[] = [
  { id: 'DSB-5521', invoice: 'INV-2038', payee: 'Kaveri Components', amount: 828000, initiatedBy: 'Nikhil Joshi', authorisedBy: '-', status: 'Pending' },
  { id: 'DSB-5519', invoice: 'INV-2031', payee: 'Kaveri Components', amount: 576000, initiatedBy: 'Sana Qureshi', authorisedBy: 'Nikhil Joshi', status: 'Disbursed' },
  { id: 'DSB-5517', invoice: 'INV-2024', payee: 'Sunrise Plastics', amount: 412000, initiatedBy: 'Sana Qureshi', authorisedBy: '-', status: 'Pending' },
  { id: 'DSB-5512', invoice: 'INV-2011', payee: 'Lotus Textiles', amount: 1260000, initiatedBy: 'Nikhil Joshi', authorisedBy: 'Sana Qureshi', status: 'Failed' },
]

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

export const RULES: Row[] = [
  { name: 'Buyer confirmed', type: 'Gate', points: 'Pass/fail', status: 'Active' },
  { name: 'Program limit headroom', type: 'Score', points: '+10 to -20', status: 'Active' },
  { name: 'Buyer concentration cap', type: 'Score', points: '-5 to -15', status: 'Active' },
  { name: 'Late payment history', type: 'Score', points: '+25 to -30', status: 'Draft' },
]

export const RULE_JSON = `{
  "id": "buyer_concentration",
  "version": 15,
  "when": {
    "fact": "buyerShareOfSupplierBook",
    "operator": "greaterThan",
    "value": 0.45
  },
  "then": { "points": -15, "reason": "Buyer share above cap" },
  "else": { "points": -5 }
}`

export const BACKTEST: Row[] = [
  { metric: 'Invoices replayed', current: '1,240', draft: '1,240' },
  { metric: 'Auto-approved', current: '62%', draft: '58%' },
  { metric: 'Referred to analyst', current: '31%', draft: '35%' },
  { metric: 'Rejected', current: '7%', draft: '7%' },
]

export const PRICING_BANDS = ['A (800+)', 'B (700-799)', 'C (600-699)', 'D (<600)']
export const PRICING_TENURES = ['30 days', '60 days', '90 days']
export const PRICING_GRID: number[][] = [
  [9.5, 10.0, 10.5],
  [10.5, 11.0, 11.75],
  [12.0, 12.75, 13.5],
  [14.5, 15.5, 16.5],
]

export const FEES: Row[] = [
  { fee: 'Processing fee', value: '0.25% of invoice, min ₹500' },
  { fee: 'Penal rate', value: '2% p.a. over contract rate' },
  { fee: 'Grace days', value: '3' },
  { fee: 'Prepayment fee', value: 'None' },
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

export const AUDIT: Row[] = [
  { time: '16 Nov, 10:42', user: 'Arjun Menon', action: 'Approved invoice', record: 'INV-2041', change: 'Status: Engine evaluated to Approved' },
  { time: '16 Nov, 10:20', user: 'Kavya Nair', action: 'Recommended decision', record: 'INV-2041', change: 'Recommendation: Approve' },
  { time: '16 Nov, 09:55', user: 'Pooja Bansal', action: 'Edited rule', record: 'buyer_concentration', change: 'Points: -10 to -15 (draft v15)' },
  { time: '15 Nov, 17:31', user: 'Nikhil Joshi', action: 'Initiated payout', record: 'DSB-5521', change: 'Amount: ₹8,28,000' },
  { time: '15 Nov, 15:08', user: 'Ishita Verma', action: 'Changed role', record: 'User: Dev Malhotra', change: 'Role: Analyst to Risk Admin' },
]

export const NOTIFICATIONS: Row[] = [
  { time: '09:12', event: 'Buyer confirmed INV-2041', channel: 'Email, in-app' },
  { time: '10:48', event: 'Financing offer ready for INV-2041', channel: 'Email, in-app' },
  { time: '13:30', event: 'INV-2019 disputed by buyer', channel: 'Email, SMS' },
  { time: '15:02', event: 'Payout sent for INV-2038', channel: 'Email, in-app' },
]

export const USERS_LIST = [
  { name: 'Meera Iyer', role: 'Supplier' },
  { name: 'Arjun Menon', role: 'Approver' },
  { name: 'Pooja Bansal', role: 'Risk Admin' },
]
