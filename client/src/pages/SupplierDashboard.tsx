import { Link } from 'react-router-dom'
import Button from '../components/Button'
import DataTable from '../components/DataTable'
import KpiRow from '../components/KpiRow'
import PageHeader from '../components/PageHeader'
import StatusPill from '../components/StatusPill'
import { SUPPLIER_INVOICES } from '../data/sample'
import { useAuth } from '../auth/AuthContext'
import { inr } from '../lib/format'

export default function SupplierDashboard() {
  const { action } = useAuth()
  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Your limit, financed invoices and what is due this week."
        actions={action('Create invoice') === 'full' && <Link to="/invoices/new"><Button>Create invoice</Button></Link>}
      />
      <KpiRow
        items={[
          { label: 'Available limit', value: '₹32.5 L', sub: 'of ₹50 L program limit', trend: 'Up ₹4 L since last week' },
          { label: 'Financed', value: '₹17.5 L', sub: '4 invoices funded', trend: '₹2.1 L disbursed this week' },
          { label: 'Due in 7 days', value: '₹9.2 L', pill: { text: 'Near limit', kind: 'warning' }, trend: '2 repayments upcoming' },
          { label: 'Early-pay savings', value: '₹48,200', sub: 'versus 60-day terms', trend: 'Up 12% on October' },
        ]}
      />
      <DataTable
        title="Recent invoices"
        columns={[
          { key: 'id', header: 'Invoice', render: (r) => <Link to={`/invoices/${r.id}`} className="font-bold text-violet">{r.id}</Link> },
          { key: 'buyer', header: 'Buyer' },
          { key: 'amount', header: 'Amount', align: 'right', render: (r) => inr(r.amount) },
          { key: 'due', header: 'Due' },
          { key: 'status', header: 'Status', render: (r) => <StatusPill kind={r.kind}>{r.status}</StatusPill> },
        ]}
        rows={SUPPLIER_INVOICES}
      />
    </>
  )
}
