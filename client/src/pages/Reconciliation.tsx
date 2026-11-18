import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { BASE, ApiError, http, tokenStore } from '../api/http'
import type { StatementDetail, StatementRow } from '../api/types'
import Button from '../components/Button'
import Card from '../components/Card'
import DataTable from '../components/DataTable'
import KpiRow from '../components/KpiRow'
import Notice from '../components/Notice'
import PageHeader from '../components/PageHeader'
import { Async, ErrorMessage, useMutation, useRequest } from '../components/RequestState'
import StatusPill from '../components/StatusPill'
import { useAuth } from '../auth/AuthContext'
import { dateTime, money, shortDate } from '../lib/format'

const loadList = () => http<StatementRow[]>('/reconciliation/statements')

// the demo statement is plain CSV, so it is fetched as text rather than through the JSON helper
async function fetchSample(): Promise<string> {
  const res = await fetch(`${BASE}/reconciliation/sample-statement`, { headers: { Authorization: `Bearer ${tokenStore.get() ?? ''}` } })
  if (!res.ok) throw new ApiError(res.status, 'Could not build the demo statement')
  return res.text()
}

function Detail({ id }: { id: string }) {
  const req = useRequest(() => http<StatementDetail>(`/reconciliation/statements/${id}`), id)
  return (
    <Async req={req}>
      {(d) => (
        <>
          <KpiRow
            items={[
              { label: 'Bank lines', value: String(d.summary.lines), sub: `${shortDate(d.statement.from)} to ${shortDate(d.statement.to)}`, trend: d.statement.name },
              { label: 'Matched', value: String(d.summary.matched), pill: { text: 'Matched', kind: 'success' }, trend: 'Same reference and amount, or one clear amount and date' },
              { label: 'Unmatched bank lines', value: String(d.summary.unmatched), sub: 'Money at the bank, no posting', trend: 'Check the note on each line' },
              { label: 'Unmatched ledger entries', value: String(d.summary.unmatchedLedger), sub: 'Posted, not at the bank', trend: 'Check the payout or repayment' },
            ]}
          />
          <DataTable
            title="Bank lines"
            columns={[
              { key: 'date', header: 'Date', render: (r) => shortDate(r.date) },
              { key: 'reference', header: 'Reference', render: (r) => <b>{r.reference || '-'}</b> },
              { key: 'description', header: 'Description' },
              { key: 'amount', header: 'Amount', align: 'right', render: (r) => <span className="whitespace-nowrap">{`${r.direction === 'IN' ? '+' : '-'}${money(r.amount)}`}</span> },
              {
                key: 'status', header: 'Result',
                render: (r) => (
                  <span>
                    <StatusPill kind={r.status === 'MATCHED' ? 'success' : 'warning'}>{r.status === 'MATCHED' ? 'Matched' : 'Unmatched'}</StatusPill>
                    <span className="mt-1 block text-xs text-muted">
                      {r.status === 'MATCHED' ? (r.method === 'REFERENCE' ? 'By reference' : 'By amount and date') : r.note}
                    </span>
                  </span>
                ),
              },
            ]}
            rows={d.lines}
            rowKey={(r) => r._id}
          />
          <DataTable
            title="Ledger entries with no bank line"
            columns={[
              { key: 'postedOn', header: 'Date', render: (r) => dateTime(r.postedOn) },
              { key: 'reference', header: 'Reference', render: (r) => <b>{r.reference}</b> },
              { key: 'invoiceNumber', header: 'Invoice', render: (r) => r.invoiceNumber ?? '-' },
              { key: 'memo', header: 'Posting', render: (r) => (r.amount < 0 ? 'Payout' : 'Repayment') },
              { key: 'amount', header: 'Amount', align: 'right', render: (r) => <span className="whitespace-nowrap">{`${r.amount > 0 ? '+' : '-'}${money(Math.abs(r.amount))}`}</span> },
            ]}
            rows={d.unmatchedLedger}
            rowKey={(r) => r.txId}
            empty="Every ledger cash entry in these dates has a bank line."
          />
        </>
      )}
    </Async>
  )
}

export default function Reconciliation() {
  const { can } = useAuth()
  const list = useRequest(loadList)
  const up = useMutation()
  const [picked, setPicked] = useState<string | null>(null)
  const [done, setDone] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const canUpload = can('reconciliation:upload')

  const send = async (name: string, csv: string) => {
    setDone('')
    const st = await up.run(() => http<StatementRow>('/reconciliation/statements', { body: { name, csv } }))
    if (st) {
      setDone(`${name} was uploaded and matched.`)
      setPicked(st._id)
      list.reload()
    }
  }

  const onFile = async (f: File | undefined) => {
    if (!f) return
    if (f.size > 800_000) return setDone('That file is too large. Statements are limited to about 800 KB.')
    await send(f.name, await f.text())
    if (file.current) file.current.value = ''
  }

  const demo = async () => {
    const csv = await up.run(fetchSample)
    if (csv) await send(`demo-statement-${new Date().toISOString().slice(0, 10)}.csv`, csv)
  }

  return (
    <>
      <PageHeader title="Reconciliation" subtitle="Bank statement lines against the ledger's cash entries." />
      {canUpload && (
        <Card title="Upload a bank statement">
          <p className="mt-0 text-sm text-muted">
            A CSV with the columns <code>date,reference,description,debit,credit</code>. Dates look like 2026-11-17 and amounts are in rupees. Debit is money leaving the bank, credit is money coming in.
          </p>
          {up.error != null && <ErrorMessage error={up.error} />}
          {done && <Notice kind={done.includes('too large') ? 'warning' : 'success'}>{done}</Notice>}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input ref={file} type="file" accept=".csv,text/csv" aria-label="Bank statement CSV" onChange={(e) => onFile(e.target.files?.[0])} className="min-h-11 text-sm" disabled={up.busy} />
            <Button variant="secondary" disabled={up.busy} onClick={demo}>Upload a demo statement</Button>
          </div>
          <p className="mb-0 mt-2 text-xs text-muted">The demo statement is built from the current ledger with a few differences left in, so there is something to reconcile.</p>
        </Card>
      )}
      <Async req={list}>
        {(statements) => {
          const current = picked ?? statements[0]?._id
          return (
            <>
              <DataTable
                title="Statements"
                columns={[
                  { key: 'name', header: 'Statement', render: (r) => <b>{r.name}</b> },
                  { key: 'range', header: 'Dates', render: (r) => `${shortDate(r.from)} to ${shortDate(r.to)}` },
                  { key: 'matched', header: 'Matched', align: 'right' },
                  { key: 'unmatched', header: 'Unmatched', align: 'right' },
                  { key: 'uploadedByName', header: 'Uploaded by', render: (r) => r.uploadedByName ?? '-' },
                  { key: 'act', header: '', render: (r) => (r._id === current ? <StatusPill kind="info">Shown below</StatusPill> : <Button variant="row" onClick={() => setPicked(r._id)}>Open</Button>) },
                ]}
                rows={statements}
                rowKey={(r) => r._id}
                empty={canUpload ? 'No statement yet. Upload one above.' : 'No statement has been uploaded yet.'}
              />
              {current && <Detail id={current} />}
              {statements.length > 0 && <p className="m-0 text-sm text-muted">Need to see the payout? <Link to="/payout-monitor" className="font-bold text-violet">Open the payout monitor</Link>.</p>}
            </>
          )
        }}
      </Async>
    </>
  )
}
