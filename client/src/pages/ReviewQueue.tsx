import { Link } from 'react-router-dom'
import { http } from '../api/http'
import type { InvoicePage } from '../api/types'
import Button from '../components/Button'
import DataTable from '../components/DataTable'
import KpiRow from '../components/KpiRow'
import PageHeader from '../components/PageHeader'
import { Async, useRequest } from '../components/RequestState'
import StatusPill from '../components/StatusPill'
import { money, shortDate } from '../lib/format'

const load = () => http<InvoicePage>('/invoices?status=ENGINE_EVALUATED&limit=100')

export default function ReviewQueue({ role }: { role: 'analyst' | 'approver' }) {
  const req = useRequest(load)
  return (
    <>
      <PageHeader
        title="Review queue"
        subtitle={role === 'analyst' ? 'Invoices waiting for your recommendation.' : 'Invoices waiting for a decision.'}
      />
      <Async req={req}>
        {(page) => {
          const rows = role === 'approver' ? page.items.filter((i) => i.recommendation) : page.items
          const recommended = page.items.filter((i) => i.recommendation).length
          return (
            <>
              <KpiRow
                items={[
                  { label: 'In queue', value: String(rows.length), sub: money(rows.reduce((s, r) => s + (r.financedAmount ?? 0), 0)), trend: 'Financed amount' },
                  { label: 'Recommended', value: String(recommended), sub: 'Ready for an approver', trend: 'By an analyst' },
                  { label: 'Not yet reviewed', value: String(page.items.length - recommended), pill: page.items.length - recommended ? { text: 'Pending', kind: 'warning' } : { text: 'All reviewed', kind: 'success' }, trend: 'Waiting on an analyst' },
                  { label: 'Total under review', value: String(page.items.length), sub: 'All invoices in review', trend: 'Right now' },
                ]}
              />
              <DataTable
                title="Queue"
                columns={[
                  { key: 'number', header: 'Invoice', render: (r) => <b>{r.number}</b> },
                  { key: 'supplierName', header: 'Supplier' },
                  { key: 'amount', header: 'Amount', align: 'right', render: (r) => money(r.amount) },
                  { key: 'financedAmount', header: 'Financed', align: 'right', render: (r) => money(r.financedAmount) },
                  { key: 'dueDate', header: 'Due', render: (r) => shortDate(r.dueDate) },
                  { key: 'recommendation', header: 'Recommendation', render: (r) => <StatusPill kind={r.recommendation ? 'info' : 'warning'}>{r.recommendation ?? 'Pending'}</StatusPill> },
                  { key: 'act', header: 'Action', render: (r) => <Link to={`/review/${r._id}`}><Button variant="row">Open</Button></Link> },
                ]}
                rows={rows}
                rowKey={(r) => r._id}
                empty="Nothing is waiting."
              />
            </>
          )
        }}
      </Async>
    </>
  )
}
