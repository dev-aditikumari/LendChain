import { useState } from 'react'
import { http } from '../api/http'
import type { Dues, Invoice, InvoicePage } from '../api/types'
import Button from '../components/Button'
import DataTable from '../components/DataTable'
import { Field } from '../components/Field'
import FormCard from '../components/FormCard'
import Notice from '../components/Notice'
import PageHeader from '../components/PageHeader'
import { Async, ErrorMessage, useMutation, useRequest } from '../components/RequestState'
import StatusPill from '../components/StatusPill'
import { money, shortDate, toPaise } from '../lib/format'
import { statusKind, statusLabel } from '../lib/invoiceStatus'

interface Row extends Invoice { dues: Dues; total: number }

const load = async (): Promise<Row[]> => {
  const [open, overdue] = await Promise.all([
    http<InvoicePage>('/invoices?status=DISBURSED&limit=100'),
    http<InvoicePage>('/invoices?status=OVERDUE&limit=100'),
  ])
  const invoices = [...overdue.items, ...open.items]
  const dues = await Promise.all(invoices.map((i) => http<Dues>(`/repayments/dues/${i._id}`)))
  return invoices.map((inv, n) => ({ ...inv, dues: dues[n], total: dues[n].principal + dues[n].penal }))
}

export default function Payables() {
  const req = useRequest(load)
  const m = useMutation()
  const [paying, setPaying] = useState<Row | null>(null)
  const [amount, setAmount] = useState('')
  const [utr, setUtr] = useState('')
  const [done, setDone] = useState('')

  const start = (r: Row) => {
    setPaying(r)
    setAmount(String(r.total / 100))
    setUtr('')
    setDone('')
    m.clear()
  }
  const pay = async () => {
    if (!paying) return
    const r = await m.run(() =>
      http<{ invoiceStatus: string }>('/repayments', { body: { invoiceId: paying._id, amount: toPaise(Number(amount)), utr: utr.trim() } }),
    )
    if (r) {
      setDone(`Payment recorded for ${paying.number}. Invoice is now ${statusLabel(r.invoiceStatus).toLowerCase()}.`)
      setPaying(null)
      req.reload()
    }
  }

  return (
    <>
      <PageHeader title="Payables" subtitle="Financed invoices you owe. Repay on or before the due date." />
      {done && <Notice kind="success">{done}</Notice>}
      {paying && (
        <FormCard
          title={`Repay ${paying.number}`}
          onSubmit={pay}
          buttons={
            <>
              <Button type="submit" disabled={m.busy || !Number(amount) || utr.trim().length < 6}>{m.busy ? 'Recording...' : 'Record payment'}</Button>
              <Button variant="secondary" onClick={() => { setPaying(null); m.clear() }}>Cancel</Button>
            </>
          }
        >
          <Field label="Amount (₹)" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} hint={`Due now: ${money(paying.total)}`} />
          <Field label="Bank reference (UTR)" value={utr} onChange={(e) => setUtr(e.target.value)} hint="At least 6 characters." />
          {m.error ? <ErrorMessage error={m.error} /> : null}
        </FormCard>
      )}
      <Async req={req}>
        {(rows) => (
          <DataTable
            title="Open invoices"
            columns={[
              { key: 'number', header: 'Invoice', render: (r) => <b>{r.number}</b> },
              { key: 'supplierName', header: 'Supplier' },
              { key: 'dueDate', header: 'Due', render: (r) => shortDate(r.dueDate) },
              { key: 'principal', header: 'Principal', align: 'right', render: (r) => money(r.dues.principal) },
              { key: 'penal', header: 'Penal', align: 'right', render: (r) => money(r.dues.penal) },
              { key: 'status', header: 'Status', render: (r) => <StatusPill kind={statusKind(r.status)}>{statusLabel(r.status)}</StatusPill> },
              { key: 'act', header: 'Action', render: (r) => <Button variant="row" onClick={() => start(r)}>Repay</Button> },
            ]}
            rows={rows}
            rowKey={(r) => r._id}
            empty="You do not owe anything right now."
          />
        )}
      </Async>
    </>
  )
}
