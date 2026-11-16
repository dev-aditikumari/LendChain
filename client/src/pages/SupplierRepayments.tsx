import { Link } from 'react-router-dom'
import { http } from '../api/http'
import type { InvoicePage } from '../api/types'
import DataTable from '../components/DataTable'
import PageHeader from '../components/PageHeader'
import { Async, useRequest } from '../components/RequestState'
import StatusPill from '../components/StatusPill'
import { money, shortDate } from '../lib/format'
import { statusKind, statusLabel } from '../lib/invoiceStatus'

const FINANCED = new Set(['DISBURSED', 'OVERDUE', 'REPAID', 'CLOSED'])
const load = () => http<InvoicePage>('/invoices?limit=100')

export default function SupplierRepayments() {
  const req = useRequest(load)
  return (
    <>
      <PageHeader title="Repayments" subtitle="Where each financed invoice stands. Your buyer repays on the due date." />
      <Async req={req}>
        {(page) => (
          <DataTable
            title="Financed invoices"
            columns={[
              { key: 'number', header: 'Invoice', render: (r) => <Link to={`/invoices/${r._id}`} className="font-bold text-violet">{r.number}</Link> },
              { key: 'buyerName', header: 'Buyer' },
              { key: 'financedAmount', header: 'Financed', align: 'right', render: (r) => money(r.financedAmount) },
              { key: 'dueDate', header: 'Due', render: (r) => shortDate(r.dueDate) },
              { key: 'status', header: 'Status', render: (r) => <StatusPill kind={statusKind(r.status)}>{statusLabel(r.status)}</StatusPill> },
            ]}
            rows={page.items.filter((i) => FINANCED.has(i.status))}
            rowKey={(r) => r._id}
            empty="Nothing has been financed yet."
          />
        )}
      </Async>
    </>
  )
}
