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
