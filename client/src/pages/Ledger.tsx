import DataTable from '../components/DataTable'
import KpiRow from '../components/KpiRow'
import PageHeader from '../components/PageHeader'
import { LEDGER } from '../data/sample'
import { inr, inrShort } from '../lib/format'

export default function Ledger() {
  const debits = LEDGER.reduce((s, r) => s + Number(r.debit), 0)
  const credits = LEDGER.reduce((s, r) => s + Number(r.credit), 0)
  return (
    <>
      <PageHeader title="Ledger" subtitle="Double-entry journal. Every posting must balance." />
      <KpiRow
        items={[
          { label: 'Debits', value: inrShort(debits), sub: `${LEDGER.length} entries`, trend: 'Last 3 days' },
          { label: 'Credits', value: inrShort(credits), sub: `${LEDGER.length} entries`, trend: 'Last 3 days' },
          { label: 'Unbalanced entries', value: '0', pill: { text: 'Balanced', kind: 'success' }, trend: 'Checked at posting' },
          { label: 'Difference', value: inr(debits - credits), sub: 'Debits minus credits', trend: 'Should stay at zero' },
        ]}
      />
      <DataTable
        title="Entries"
        columns={[
          { key: 'id', header: 'Entry', render: (r) => <b>{r.id}</b> },
          { key: 'date', header: 'Date' },
          { key: 'account', header: 'Account' },
          { key: 'debit', header: 'Debit', align: 'right', render: (r) => (r.debit ? inr(Number(r.debit)) : '-') },
          { key: 'credit', header: 'Credit', align: 'right', render: (r) => (r.credit ? inr(Number(r.credit)) : '-') },
        ]}
        rows={LEDGER}
      />
    </>
  )
}
