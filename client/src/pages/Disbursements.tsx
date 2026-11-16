import { Link } from 'react-router-dom'
import { http } from '../api/http'
import type { Disbursement, InvoicePage } from '../api/types'
import Button from '../components/Button'
import DataTable from '../components/DataTable'
import Notice from '../components/Notice'
import PageHeader from '../components/PageHeader'
import { Async, ErrorMessage, useMutation, useRequest } from '../components/RequestState'
import StatusPill from '../components/StatusPill'
import { useAuth } from '../auth/AuthContext'
import { money, shortDate } from '../lib/format'

const load = () =>
  Promise.all([
    http<InvoicePage>('/invoices?status=APPROVED&limit=100'),
    http<Disbursement[]>('/disbursements'),
  ]).then(([approved, payouts]) => ({ approved: approved.items, payouts }))

const STATUS: Record<Disbursement['status'], string> = { PENDING_AUTH: 'Pending', SUCCESS: 'Disbursed', FAILED: 'Failed' }

export default function Disbursements() {
  const { can } = useAuth()
  const req = useRequest(load)
  const m = useMutation()

  const initiate = async (invoiceId: string) => {
    await m.run(() => http('/disbursements', { body: { invoiceId } }))
    req.reload()
  }
  const authorise = async (id: string) => {
    // a fresh key per click; a retry of the same click would reuse it
    await m.run(() => http(`/disbursements/${id}/authorise`, { method: 'POST', body: {}, headers: { 'Idempotency-Key': crypto.randomUUID() } }))
    req.reload()
  }

  return (
    <>
      <PageHeader title="Disbursements" subtitle="Queue approved invoices for payout, then have a second person release them." />
      <Notice>Dual control: the person who queues a payout cannot authorise it, and nobody can pay out an invoice they approved.</Notice>
      {m.error ? <ErrorMessage error={m.error} /> : null}
      <Async req={req}>
        {({ approved, payouts }) => {
          const queued = new Set(payouts.filter((p) => p.status !== 'FAILED').map((p) => p.invoiceId?._id))
          const ready = approved.filter((i) => !queued.has(i._id))
          return (
            <>
              <DataTable
                title="Approved, ready to queue"
                columns={[
                  { key: 'number', header: 'Invoice', render: (r) => <Link to={`/invoices/${r._id}`} className="font-bold text-violet">{r.number}</Link> },
                  { key: 'supplierName', header: 'Supplier' },
                  { key: 'financedAmount', header: 'Advance', align: 'right', render: (r) => money(r.financedAmount) },
                  { key: 'dueDate', header: 'Due', render: (r) => shortDate(r.dueDate) },
                  {
                    key: 'act', header: 'Action',
                    render: (r) => can('disbursement:initiate') && <Button variant="row" disabled={m.busy} onClick={() => initiate(r._id)}>Queue payout</Button>,
                  },
                ]}
                rows={ready}
                rowKey={(r) => r._id}
                empty="No approved invoices are waiting."
              />
              <DataTable
                title="Payout queue"
                columns={[
                  { key: 'invoice', header: 'Invoice', render: (r) => <b>{r.invoiceId?.number ?? '-'}</b> },
                  { key: 'payee', header: 'Payee', render: (r) => r.invoiceId?.supplierId?.legalName ?? '-' },
                  { key: 'amount', header: 'Amount', align: 'right', render: (r) => money(r.net ?? r.amount) },
                  { key: 'initiatedBy', header: 'Queued by', render: (r) => r.initiatedBy?.name ?? '-' },
                  { key: 'authorisedBy', header: 'Authorised by', render: (r) => r.authorisedBy?.name ?? '-' },
                  { key: 'status', header: 'Status', render: (r) => <StatusPill>{STATUS[r.status]}</StatusPill> },
                  {
                    key: 'act', header: 'Action',
                    render: (r) => can('disbursement:authorise') && r.status === 'PENDING_AUTH' && (
                      <Button variant="row" disabled={m.busy} onClick={() => authorise(r._id)}>Authorise</Button>
                    ),
                  },
                ]}
                rows={payouts}
                rowKey={(r) => r._id}
                empty="No payouts yet."
              />
            </>
          )
        }}
      </Async>
    </>
  )
}
