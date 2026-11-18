import { useState } from 'react'
import { Link } from 'react-router-dom'
import { http } from '../api/http'
import type { LedgerPage, LedgerRow } from '../api/types'
import Button from '../components/Button'
import DataTable from '../components/DataTable'
import { SelectField, TextArea } from '../components/Field'
import FormCard from '../components/FormCard'
import KpiRow from '../components/KpiRow'
import Notice from '../components/Notice'
import PageHeader from '../components/PageHeader'
import { Async, ErrorMessage, useMutation, useRequest } from '../components/RequestState'
import StatusPill from '../components/StatusPill'
import { useAuth } from '../auth/AuthContext'
import { ACCOUNT_LABEL, accountLabel } from '../lib/accounts'
import { dateTime, money } from '../lib/format'

export default function Ledger() {
  const { can } = useAuth()
  const [account, setAccount] = useState('')
  const [page, setPage] = useState(1)
  const [reversing, setReversing] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [done, setDone] = useState('')
  const m = useMutation()

  const req = useRequest(
    () => http<LedgerPage>(`/ledger/entries?page=${page}&limit=25${account ? `&account=${account}` : ''}`),
    `${account}|${page}`,
  )

  const reverse = async () => {
    if (!reversing) return
    const r = await m.run(() => http(`/ledger/transactions/${encodeURIComponent(reversing)}/reverse`, { body: { reason } }))
    if (r) {
      setDone(`Transaction ${reversing} was reversed.`)
      setReversing(null)
      setReason('')
      req.reload()
    }
  }

  return (
    <>
      <PageHeader title="Ledger" subtitle="Double-entry journal. Every posting balances, and entries are never edited: a mistake is fixed with a reversal." />
      {done && <Notice kind="success">{done}</Notice>}
      <Async req={req}>
        {(data) => {
          const pages = Math.max(1, Math.ceil(data.total / data.limit))
          // a transaction's lines sit together, so the action goes on its first line only
          const firstOf = new Set<string>()
          const showAction = (r: LedgerRow) => {
            if (firstOf.has(r.txId)) return false
            firstOf.add(r.txId)
            return true
          }
          return (
            <>
              <KpiRow
                items={[
                  { label: 'Debits', value: money(data.totals.debit), sub: 'All entries', trend: 'Whole ledger' },
                  { label: 'Credits', value: money(data.totals.credit), sub: 'All entries', trend: 'Whole ledger' },
                  { label: 'Unbalanced transactions', value: String(data.totals.unbalanced), pill: data.totals.unbalanced === 0 ? { text: 'Balanced', kind: 'success' } : { text: 'Check now', kind: 'danger' }, trend: 'Checked at posting' },
                  { label: 'Difference', value: money(data.totals.difference), sub: 'Debits minus credits', trend: 'Stays at zero' },
                ]}
              />
              {reversing && (
                <FormCard
                  title={`Reverse ${reversing}`}
                  onSubmit={reverse}
                  buttons={
                    <>
                      <Button type="submit" disabled={m.busy}>Post reversal</Button>
                      <Button variant="secondary" onClick={() => { setReversing(null); m.clear() }}>Cancel</Button>
                    </>
                  }
                >
                  <p className="m-0 text-sm text-muted">
                    This posts a new entry with debits and credits swapped, dated today. It does not change the invoice or the payout record behind the transaction.
                  </p>
                  {m.error != null && <ErrorMessage error={m.error} />}
                  <TextArea label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this transaction is being reversed" />
                </FormCard>
              )}
              <DataTable
                title={`Entries (${data.total})`}
                action={
                  <div className="w-56">
                    <SelectField label="Account" value={account} onChange={(e) => { setAccount(e.target.value); setPage(1) }}>
                      <option value="">All accounts</option>
                      {Object.entries(ACCOUNT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </SelectField>
                  </div>
                }
                columns={[
                  { key: 'postedOn', header: 'Date', render: (r) => dateTime(r.postedOn) },
                  {
                    key: 'txId', header: 'Transaction',
                    render: (r) => (
                      <span>
                        <b className="break-all">{r.txId}</b>
                        <span className="block text-xs text-muted">{r.memo}</span>
                      </span>
                    ),
                  },
                  { key: 'invoiceNumber', header: 'Invoice', render: (r) => r.invoiceId && r.invoiceNumber ? <Link to={`/invoices/${r.invoiceId}`} className="font-bold text-violet">{r.invoiceNumber}</Link> : '-' },
                  { key: 'account', header: 'Account', render: (r) => accountLabel(r.account) },
                  { key: 'debit', header: 'Debit', align: 'right', render: (r) => (r.debit ? money(r.debit) : '-') },
                  { key: 'credit', header: 'Credit', align: 'right', render: (r) => (r.credit ? money(r.credit) : '-') },
                  {
                    key: 'act', header: '',
                    render: (r) => {
                      if (!showAction(r)) return null
                      if (r.reversed) return <StatusPill kind="neutral">Reversed</StatusPill>
                      if (r.reverses) return <StatusPill kind="info">Reversal</StatusPill>
                      return can('journal:post') ? <Button variant="row" onClick={() => { setReversing(r.txId); setDone(''); m.clear() }}>Reverse</Button> : null
                    },
                  },
                ]}
                rows={data.items}
                rowKey={(r) => r._id}
                empty="No entries yet."
              />
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted">Page {data.page} of {pages}</span>
                <div className="flex gap-2">
                  <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                  <Button variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
                </div>
              </div>
            </>
          )
        }}
      </Async>
    </>
  )
}
