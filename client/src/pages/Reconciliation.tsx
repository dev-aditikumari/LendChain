import DataTable from '../components/DataTable'
import KpiRow from '../components/KpiRow'
import PageHeader from '../components/PageHeader'
import StatusPill from '../components/StatusPill'
import { RECON } from '../data/sample'
import { inr } from '../lib/format'

export default function Reconciliation() {
  const bank = RECON.reduce((s, r) => s + Number(r.bank), 0)
  const ledger = RECON.reduce((s, r) => s + Number(r.ledger), 0)
  const matched = RECON.filter((r) => r.status === 'Matched').length
  const pct = Math.round((matched / RECON.length) * 100)
  return (
    <>
      <PageHeader title="Reconciliation" subtitle="Bank statement lines against ledger postings." />
      <KpiRow
        items={[
          { label: 'Matched', value: `${pct}%`, sub: `${matched} of ${RECON.length} lines`, trend: 'Auto-matched on UTR' },
          { label: 'Unmatched bank lines', value: String(RECON.filter((r) => Number(r.ledger) === 0).length), sub: 'Money in bank, no posting', trend: 'Raise an exception' },
          { label: 'Unmatched ledger', value: String(RECON.filter((r) => Number(r.bank) === 0).length), sub: 'Posted, not in bank', trend: 'Check payout status' },
          { label: 'Difference', value: inr(bank - ledger), sub: 'Bank minus ledger', trend: 'Should reach zero at close' },
        ]}
      />
      <DataTable
        title="Bank vs ledger"
        columns={[
          { key: 'utr', header: 'Reference', render: (r) => <b>{r.utr}</b> },
          { key: 'bank', header: 'Bank', align: 'right', render: (r) => (r.bank ? inr(Number(r.bank)) : '-') },
          { key: 'ledger', header: 'Ledger', align: 'right', render: (r) => (r.ledger ? inr(Number(r.ledger)) : '-') },
          { key: 'status', header: 'Status', render: (r) => <StatusPill>{String(r.status)}</StatusPill> },
        ]}
        rows={RECON}
      />
    </>
  )
}
