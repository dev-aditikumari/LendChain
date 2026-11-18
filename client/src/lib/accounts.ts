export const ACCOUNT_LABEL: Record<string, string> = {
  LENDER_POOL: 'Lender pool (cash)',
  BUYER_RECEIVABLE: 'Buyer receivable',
  SUPPLIER_RECEIVABLE: 'Supplier receivable',
  UNEARNED_INTEREST: 'Unearned interest',
  INTEREST_INCOME: 'Interest income',
  FEE_INCOME: 'Fee income',
  PENAL_INCOME: 'Penal income',
  HOLDBACK: 'Holdback',
  BANK: 'Bank',
}

export const accountLabel = (a: string) => ACCOUNT_LABEL[a] ?? a

// "2026-10" -> "October 2026"
export function periodLabel(key: string) {
  return new Date(`${key}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}
