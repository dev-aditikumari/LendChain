import { useState } from 'react'
import { Link } from 'react-router-dom'
import { http } from '../api/http'
import type { ExceptionRow } from '../api/types'
import Button from '../components/Button'
import DataTable from '../components/DataTable'
import { TextArea } from '../components/Field'
import FormCard from '../components/FormCard'
import KpiRow from '../components/KpiRow'
import Notice from '../components/Notice'
import PageHeader from '../components/PageHeader'
import { Async, ErrorMessage, useMutation, useRequest } from '../components/RequestState'
import StatusPill, { type PillKind } from '../components/StatusPill'
import { useAuth } from '../auth/AuthContext'
import { dateTime } from '../lib/format'

const load = () => http<ExceptionRow[]>('/exceptions')

const KIND: Record<ExceptionRow['kind'], string> = { PAYOUT_FAILED: 'Failed payout', WEBHOOK_PROBLEM: 'Bank webhook problem' }
const SEVERITY: Record<ExceptionRow['severity'], PillKind> = { HIGH: 'danger', MEDIUM: 'warning', LOW: 'neutral' }
const LABEL: Record<ExceptionRow['severity'], string> = { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' }

export default function Exceptions() {
  const { can } = useAuth()
  const req = useRequest(load)
  const m = useMutation()
  const [tab, setTab] = useState<'OPEN' | 'RESOLVED'>('OPEN')
  const [resolving, setResolving] = useState<ExceptionRow | null>(null)
  const [note, setNote] = useState('')
  const [done, setDone] = useState('')
  const canResolve = can('exception:resolve')

  const act = async (fn: () => Promise<unknown>, message: string) => {
    setDone('')
    const r = await m.run(fn)
    if (r !== undefined) { setDone(message); req.reload() }
    return r
  }
  const resolve = async () => {
    if (!resolving) return
    const r = await act(() => http(`/exceptions/${resolving._id}/resolve`, { body: { note } }), 'Exception resolved.')
    if (r !== undefined) { setResolving(null); setNote('') }
  }

  return (
    <>
      <PageHeader title="Exceptions" subtitle="Payouts the bank refused and bank messages the system could not trust or place." />
      <Async req={req}>
        {(all) => {
          const open = all.filter((e) => e.status === 'OPEN')
          const rows = all.filter((e) => e.status === tab)
          return (
            <>
              <KpiRow
                items={[
                  { label: 'Open', value: String(open.length), sub: 'Waiting for action', trend: 'Newest first' },
                  { label: 'High severity', value: String(open.filter((e) => e.severity === 'HIGH').length), pill: { text: 'High', kind: 'danger' }, trend: 'Money may be stuck' },
                  { label: 'Unassigned', value: String(open.filter((e) => !e.owner).length), sub: 'No owner yet', trend: 'Pick these up first' },
                  { label: 'Resolved', value: String(all.length - open.length), sub: 'Closed so far', trend: 'Kept for the record' },
                ]}
              />
              {done && <Notice kind="success">{done}</Notice>}
              {m.error != null && <ErrorMessage error={m.error} />}
              {resolving && (
                <FormCard
                  title={`Resolve: ${resolving.title}`}
                  onSubmit={resolve}
                  buttons={<><Button type="submit" disabled={m.busy}>Mark resolved</Button><Button variant="secondary" onClick={() => setResolving(null)}>Cancel</Button></>}
                >
                  <TextArea label="What was done" value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: supplier was paid by hand on 17 Nov, UTR 123456" />
                </FormCard>
              )}
              <div role="tablist" className="flex gap-2">
                {(['OPEN', 'RESOLVED'] as const).map((t) => (
                  <Button key={t} variant={tab === t ? 'primary' : 'secondary'} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
                    {t === 'OPEN' ? `Open (${open.length})` : `Resolved (${all.length - open.length})`}
                  </Button>
                ))}
              </div>
              <DataTable
                title={tab === 'OPEN' ? 'Open exceptions' : 'Resolved exceptions'}
                columns={[
                  { key: 'kind', header: 'Type', render: (r) => <b>{KIND[r.kind]}</b> },
                  {
                    key: 'record', header: 'Record',
                    render: (r) => (
                      <span>
                        {r.invoiceId && r.invoiceNumber ? <Link to={`/invoices/${r.invoiceId}`} className="font-bold text-violet">{r.invoiceNumber}</Link> : null}
                        <span className="block text-sm">{r.detail ?? r.title}</span>
                        {r.resolution && <span className="block text-xs text-muted">Resolution: {r.resolution}{r.resolvedByName ? ` (${r.resolvedByName})` : ''}</span>}
                      </span>
                    ),
                  },
                  { key: 'severity', header: 'Severity', render: (r) => <StatusPill kind={SEVERITY[r.severity]}>{LABEL[r.severity]}</StatusPill> },
                  { key: 'ownerName', header: 'Owner', render: (r) => r.ownerName ?? 'Unassigned' },
                  { key: 'createdAt', header: 'Raised', render: (r) => dateTime(r.createdAt) },
                  {
                    key: 'act', header: 'Action',
                    render: (r) => {
                      if (!canResolve || r.status !== 'OPEN') return null
                      return (
                        <span className="inline-flex flex-wrap gap-2">
                          {!r.owner && <Button variant="row" disabled={m.busy} onClick={() => act(() => http(`/exceptions/${r._id}/assign`, { body: {} }), 'Assigned to you.')}>Assign to me</Button>}
                          {r.kind === 'PAYOUT_FAILED' && (r.retryDisbursementId
                            ? <span className="text-sm text-muted">Retry queued, waiting for authorisation</span>
                            : <Button variant="row" disabled={m.busy} onClick={() => act(() => http(`/exceptions/${r._id}/retry`, { body: {} }), 'Payout queued again. A finance user has to authorise it.')}>Retry payout</Button>)}
                          <Button variant="row" onClick={() => { setResolving(r); setNote(''); setDone(''); m.clear() }}>Resolve</Button>
                        </span>
                      )
                    },
                  },
                ]}
                rows={rows}
                rowKey={(r) => r._id}
                empty={tab === 'OPEN' ? 'No open exceptions.' : 'Nothing has been resolved yet.'}
              />
            </>
          )
        }}
      </Async>
    </>
  )
}
