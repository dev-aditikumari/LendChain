import Button from '../components/Button'
import DataTable from '../components/DataTable'
import KpiRow from '../components/KpiRow'
import PageHeader from '../components/PageHeader'
import StatusPill from '../components/StatusPill'
import { OVERDUE } from '../data/sample'
import { useAuth } from '../auth/AuthContext'
import { inr, inrShort } from '../lib/format'

export default function Ageing() {
  const { action } = useAuth()
  const canFollow = action('Follow up overdue') === 'full'
  const sum = (b: string) => OVERDUE.filter((r) => r.bucket === b).reduce((s, r) => s + Number(r.amount), 0)
  return (
    <>
      <PageHeader title="Ageing" subtitle="Overdue amounts grouped by days past due." />
      <KpiRow
        items={[
          { label: '0-30 days', value: inrShort(sum('0-30')), sub: '1 invoice', trend: 'Reminder stage' },
          { label: '31-60 days', value: inrShort(sum('31-60')), sub: '1 invoice', trend: 'Call the buyer' },
          { label: '61-90 days', value: inrShort(sum('61-90')), sub: '1 invoice', trend: 'Escalate' },
          { label: '90+ days', value: inrShort(sum('90+')), pill: { text: 'High', kind: 'danger' }, trend: 'Legal review' },
        ]}
      />
      <DataTable
        title="Overdue invoices"
        columns={[
          { key: 'id', header: 'Invoice', render: (r) => <b>{r.id}</b> },
          { key: 'buyer', header: 'Buyer' },
          { key: 'amount', header: 'Amount', align: 'right', render: (r) => inr(Number(r.amount)) },
          { key: 'days', header: 'Days overdue', align: 'right' },
          { key: 'bucket', header: 'Bucket', render: (r) => <StatusPill kind={r.bucket === '90+' ? 'danger' : r.bucket === '0-30' ? 'neutral' : 'warning'}>{String(r.bucket)}</StatusPill> },
          { key: 'contact', header: 'Contact' },
          { key: 'act', header: 'Action', render: () => canFollow && <Button variant="row">Follow up</Button> },
        ]}
        rows={OVERDUE}
      />
    </>
  )
}
