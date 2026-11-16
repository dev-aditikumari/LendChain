import { Link } from 'react-router-dom'
import { http } from '../api/http'
import type { InvoicePage } from '../api/types'
import DataTable from '../components/DataTable'
import PageHeader from '../components/PageHeader'
import { Async, useRequest } from '../components/RequestState'
import { money, shortDate } from '../lib/format'

const load = () => http<InvoicePage>('/invoices?status=DISPUTED&limit=100')

export default function Disputes() {
  const req = useRequest(load)
  return (
    <>
      <PageHeader title="Disputes" subtitle="Invoices you have disputed. Financing stays paused on them." />
      <Async req={req}>
        {(page) => (
          <DataTable
            title="Disputed invoices"
            columns={[
              { key: 'number', header: 'Invoice', render: (r) => <Link to={`/invoices/${r._id}`} className="font-bold text-violet">{r.number}</Link> },
              { key: 'supplierName', header: 'Supplier' },
              { key: 'amount', header: 'Amount', align: 'right', render: (r) => money(r.amount) },
              { key: 'disputeReason', header: 'Reason' },
              { key: 'dueDate', header: 'Due', render: (r) => shortDate(r.dueDate) },
            ]}
            rows={page.items}
            rowKey={(r) => r._id}
            empty="You have no disputed invoices."
          />
        )}
      </Async>
    </>
  )
}
