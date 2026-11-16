import { Link } from 'react-router-dom'
import { http } from '../api/http'
import type { InvoicePage } from '../api/types'
import Button from '../components/Button'
import DataTable from '../components/DataTable'
import PageHeader from '../components/PageHeader'
import { Async, useRequest } from '../components/RequestState'
import StatusPill from '../components/StatusPill'
import { useAuth } from '../auth/AuthContext'
import { money, shortDate } from '../lib/format'
import { statusKind, statusLabel } from '../lib/invoiceStatus'

const load = () => http<InvoicePage>('/invoices?limit=100')

export default function InvoiceList() {
  const { can } = useAuth()
  const req = useRequest(load)
  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="Every invoice you can see and where it stands."
        actions={can('invoice:create') && <Link to="/invoices/new"><Button>Create invoice</Button></Link>}
      />
      <Async req={req}>
        {(page) => (
          <DataTable
            title="All invoices"
            columns={[
              { key: 'number', header: 'Invoice', render: (r) => <Link to={`/invoices/${r._id}`} className="font-bold text-violet">{r.number}</Link> },
              { key: 'buyerName', header: 'Buyer' },
              { key: 'amount', header: 'Amount', align: 'right', render: (r) => money(r.amount) },
              { key: 'dueDate', header: 'Due', render: (r) => shortDate(r.dueDate) },
              { key: 'status', header: 'Status', render: (r) => <StatusPill kind={statusKind(r.status)}>{statusLabel(r.status)}</StatusPill> },
            ]}
            rows={page.items}
            rowKey={(r) => r._id}
            empty="No invoices yet."
          />
        )}
      </Async>
    </>
  )
}
