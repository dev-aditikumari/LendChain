import { useState } from 'react'
import { Link } from 'react-router-dom'
import { http } from '../api/http'
import type { Invoice, InvoicePage } from '../api/types'
import Button from '../components/Button'
import DataTable from '../components/DataTable'
import { TextArea } from '../components/Field'
import FormCard from '../components/FormCard'
import KpiRow from '../components/KpiRow'
import PageHeader from '../components/PageHeader'
import { Async, ErrorMessage, useMutation, useRequest } from '../components/RequestState'
import StatusPill from '../components/StatusPill'
import { useAuth } from '../auth/AuthContext'
import { money, shortDate } from '../lib/format'
import { statusKind, statusLabel } from '../lib/invoiceStatus'

const load = () => http<InvoicePage>('/invoices?limit=100')

export default function BuyerInbox() {
  const { can } = useAuth()
  const req = useRequest(load)
  const m = useMutation()
  const [disputing, setDisputing] = useState<Invoice | null>(null)
  const [reason, setReason] = useState('')
  const canAct = can('invoice:confirm')

  const confirm = async (inv: Invoice) => {
    await m.run(() => http(`/invoices/${inv._id}/confirm`, { method: 'POST', body: {} }))
    req.reload()
  }
  const dispute = async () => {
    if (!disputing) return
    const r = await m.run(() => http(`/invoices/${disputing._id}/dispute`, { body: { reason: reason.trim() } }))
    if (r !== undefined) {
      setDisputing(null)
      setReason('')
      req.reload()
    }
  }

  return (
    <>
      <PageHeader title="Invoice inbox" subtitle="Invoices addressed to you. Confirm the ones you agree to pay." />
      {m.error ? <ErrorMessage error={m.error} /> : null}
      {disputing && (
        <FormCard
          title={`Dispute ${disputing.number}`}
          onSubmit={dispute}
          buttons={
            <>
              <Button type="submit" variant="danger" disabled={m.busy || reason.trim().length < 3}>Send dispute</Button>
              <Button variant="secondary" onClick={() => { setDisputing(null); m.clear() }}>Cancel</Button>
            </>
          }
        >
          <TextArea label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormCard>
      )}
      <Async req={req}>
        {(page) => {
          const rows = page.items
          const waiting = rows.filter((r) => r.status === 'SUBMITTED')
          const disputed = rows.filter((r) => r.status === 'DISPUTED')
          const open = rows.filter((r) => r.status === 'DISBURSED' || r.status === 'OVERDUE')
          const soon = Date.now() + 7 * 86400000
          const dueSoon = open.filter((r) => new Date(r.dueDate).getTime() <= soon)
          const total = (xs: Invoice[], key: 'amount' | 'financedAmount' = 'amount') => xs.reduce((s, r) => s + (r[key] ?? 0), 0)
          return (
            <>
              <KpiRow
                items={[
                  { label: 'Awaiting you', value: String(waiting.length), sub: money(total(waiting)), trend: 'Confirm or dispute' },
                  { label: 'To repay', value: money(total(open, 'financedAmount')), sub: `${open.length} invoice${open.length === 1 ? '' : 's'}`, trend: 'Financed and not yet repaid' },
                  { label: 'Disputed', value: String(disputed.length), pill: disputed.length ? { text: 'Disputed', kind: 'danger' } : { text: 'None', kind: 'success' }, trend: 'Financing paused on these' },
                  { label: 'Due in 7 days', value: money(total(dueSoon, 'financedAmount')), sub: `${dueSoon.length} invoice${dueSoon.length === 1 ? '' : 's'}`, trend: 'Repay from Payables' },
                ]}
              />
              <DataTable
                title="Inbox"
                columns={[
                  { key: 'number', header: 'Invoice', render: (r) => <Link to={`/invoices/${r._id}`} className="font-bold text-violet">{r.number}</Link> },
                  { key: 'supplierName', header: 'Supplier' },
                  { key: 'amount', header: 'Amount', align: 'right', render: (r) => money(r.amount) },
                  { key: 'dueDate', header: 'Due', render: (r) => shortDate(r.dueDate) },
                  { key: 'status', header: 'Status', render: (r) => <StatusPill kind={statusKind(r.status)}>{statusLabel(r.status)}</StatusPill> },
                  {
                    key: 'act', header: 'Action',
                    render: (r) => canAct && r.status === 'SUBMITTED' && (
                      <span className="flex gap-2">
                        <Button variant="row" disabled={m.busy} onClick={() => confirm(r)}>Accept</Button>
                        <Button variant="row" disabled={m.busy} onClick={() => { setDisputing(r); setReason(''); m.clear() }}>Dispute</Button>
                      </span>
                    ),
                  },
                ]}
                rows={rows}
                rowKey={(r) => r._id}
                empty="Nothing has been sent to you yet."
              />
            </>
          )
        }}
      </Async>
    </>
  )
}
