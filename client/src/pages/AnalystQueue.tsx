import { Link } from 'react-router-dom'
import Button from '../components/Button'
import DataTable from '../components/DataTable'
import KpiRow from '../components/KpiRow'
import PageHeader from '../components/PageHeader'
import StatusPill from '../components/StatusPill'
import { ANALYST_QUEUE } from '../data/sample'
import { inr } from '../lib/format'

export default function AnalystQueue() {
  return (
    <>
      <PageHeader title="Review queue" subtitle="Invoices waiting for your recommendation." />
      <KpiRow
        items={[
          { label: 'In queue', value: '5', sub: '₹89.8 L in total', trend: '2 added today' },
          { label: 'Referred by engine', value: '2', sub: 'Need a manual look', trend: 'Out of 5' },
          { label: 'SLA at risk', value: '1', pill: { text: 'Overdue', kind: 'danger' }, trend: 'INV-2046' },
          { label: 'Cleared this week', value: '23', sub: 'Average 4.1 hours', trend: 'Up 6 on last week' },
        ]}
      />
      <DataTable
        title="Queue"
        columns={[
          { key: 'id', header: 'Invoice', render: (r) => <b>{r.id}</b> },
          { key: 'supplier', header: 'Supplier' },
          { key: 'amount', header: 'Amount', align: 'right', render: (r) => inr(Number(r.amount)) },
          { key: 'engine', header: 'Engine result', render: (r) => <StatusPill>{String(r.engine)}</StatusPill> },
          { key: 'sla', header: 'SLA', render: (r) => <StatusPill kind={r.sla === 'Overdue' ? 'danger' : 'neutral'}>{String(r.sla)}</StatusPill> },
          { key: 'act', header: 'Action', render: () => <Link to="/review"><Button variant="row">Open</Button></Link> },
        ]}
        rows={ANALYST_QUEUE}
      />
    </>
  )
}
