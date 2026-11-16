import DataTable from '../components/DataTable'
import KpiRow from '../components/KpiRow'
import PageHeader from '../components/PageHeader'
import { TRIAL_BALANCE } from '../data/sample'
import { inr, inrShort } from '../lib/format'

export default function TrialBalance() {
  const debits = TRIAL_BALANCE.reduce((s, r) => s + Number(r.debit), 0)
  const credits = TRIAL_BALANCE.reduce((s, r) => s + Number(r.credit), 0)
  return (
    <>
      <PageHeader sample title="Trial balance" subtitle="Closing balances as of 16 Nov 2026." />
      <KpiRow
        items={[
          { label: 'Total debits', value: inrShort(debits), sub: `${TRIAL_BALANCE.length} accounts`, trend: 'Month to date' },
          { label: 'Total credits', value: inrShort(credits), sub: `${TRIAL_BALANCE.length} accounts`, trend: 'Month to date' },
          { label: 'Difference', value: inr(debits - credits), pill: { text: debits === credits ? 'Balanced' : 'Failed', kind: debits === credits ? 'success' : 'danger' }, trend: 'Must be zero to close' },
          { label: 'Open journals', value: '0', sub: 'None awaiting posting', trend: 'All posted' },
        ]}
      />
      <DataTable
        title="Accounts"
        columns={[
          { key: 'code', header: 'Code' },
          { key: 'account', header: 'Account' },
          { key: 'debit', header: 'Debit', align: 'right', render: (r) => (r.debit ? inr(Number(r.debit)) : '-') },
          { key: 'credit', header: 'Credit', align: 'right', render: (r) => (r.credit ? inr(Number(r.credit)) : '-') },
        ]}
        rows={TRIAL_BALANCE}
      />
    </>
  )
}
