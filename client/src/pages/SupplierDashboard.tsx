import { Link } from 'react-router-dom'
import { http } from '../api/http'
import type { InvoicePage, Program } from '../api/types'
import Button from '../components/Button'
import DataTable from '../components/DataTable'
import KpiRow from '../components/KpiRow'
import PageHeader from '../components/PageHeader'
import { Async, useRequest } from '../components/RequestState'
import StatusPill from '../components/StatusPill'
import { useAuth } from '../auth/AuthContext'
import { money, shortDate } from '../lib/format'
import { statusKind, statusLabel } from '../lib/invoiceStatus'

const load = () =>
  Promise.all([http<InvoicePage>('/invoices?limit=100'), http<Program[]>('/programs')]).then(([invoices, programs]) => ({
    invoices: invoices.items,
    programs,
  }))

export default function SupplierDashboard() {
  const { can } = useAuth()
  const req = useRequest(load)
  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Your limit, financed invoices and what is due this week."
        actions={can('invoice:create') && <Link to="/invoices/new"><Button>Create invoice</Button></Link>}
      />
      <Async req={req}>
        {({ invoices, programs }) => {
          const sum = (xs: typeof invoices) => xs.reduce((s, i) => s + (i.financedAmount ?? 0), 0)
          const open = invoices.filter((i) => i.status === 'DISBURSED' || i.status === 'OVERDUE')
          const soon = Date.now() + 7 * 86400000
          const dueSoon = invoices.filter((i) => i.status === 'DISBURSED' && new Date(i.dueDate).getTime() <= soon)
          const overdue = invoices.filter((i) => i.status === 'OVERDUE')
          const sanctioned = programs.reduce((s, p) => s + p.sanctioned, 0)
          const available = programs.reduce((s, p) => s + p.sanctioned - p.outstanding, 0)
          return (
            <>
              <KpiRow
                items={[
                  { label: 'Available limit', value: money(available), sub: `of ${money(sanctioned)} sanctioned`, trend: `${programs.length} program${programs.length === 1 ? '' : 's'}` },
                  { label: 'Financed', value: money(sum(open)), sub: `${open.length} open invoice${open.length === 1 ? '' : 's'}`, trend: 'Disbursed and not yet repaid' },
                  { label: 'Due in 7 days', value: money(sum(dueSoon)), sub: `${dueSoon.length} invoice${dueSoon.length === 1 ? '' : 's'}`, trend: 'Buyer repays on the due date' },
                  {
                    label: 'Overdue', value: money(sum(overdue)),
                    pill: overdue.length ? { text: `${overdue.length} overdue`, kind: 'danger' } : { text: 'None overdue', kind: 'success' },
                    trend: 'Past the due date',
                  },
                ]}
              />
              <DataTable
                title="Recent invoices"
                action={<Link to="/invoices" className="text-sm font-bold text-violet">View all</Link>}
                columns={[
                  { key: 'number', header: 'Invoice', render: (r) => <Link to={`/invoices/${r._id}`} className="font-bold text-violet">{r.number}</Link> },
                  { key: 'buyerName', header: 'Buyer' },
                  { key: 'amount', header: 'Amount', align: 'right', render: (r) => money(r.amount) },
                  { key: 'dueDate', header: 'Due', render: (r) => shortDate(r.dueDate) },
                  { key: 'status', header: 'Status', render: (r) => <StatusPill kind={statusKind(r.status)}>{statusLabel(r.status)}</StatusPill> },
                ]}
                rows={invoices.slice(0, 8)}
                rowKey={(r) => r._id}
                empty="No invoices yet. Create your first one."
              />
            </>
          )
        }}
      </Async>
    </>
  )
}
