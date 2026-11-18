import { useState } from 'react'
import { http } from '../api/http'
import type { PeriodRow } from '../api/types'
import Button from '../components/Button'
import DataTable from '../components/DataTable'
import Notice from '../components/Notice'
import PageHeader from '../components/PageHeader'
import { Async, ErrorMessage, useMutation, useRequest } from '../components/RequestState'
import StatusPill, { type PillKind } from '../components/StatusPill'
import { useAuth } from '../auth/AuthContext'
import { periodLabel } from '../lib/accounts'
import { dateTime, money } from '../lib/format'

const load = () => http<PeriodRow[]>('/ledger/periods')

const STATUS: Record<PeriodRow['status'], { label: string; kind: PillKind }> = {
  OPEN: { label: 'Open', kind: 'info' },
  CLOSE_REQUESTED: { label: 'Waiting for sign-off', kind: 'warning' },
  CLOSED: { label: 'Closed', kind: 'success' },
}

export default function PeriodClose() {
  const { user, can } = useAuth()
  const req = useRequest(load)
  const m = useMutation()
  const [done, setDone] = useState('')
  const canClose = can('period:close')

  const act = async (key: string, step: 'request-close' | 'sign-off') => {
    setDone('')
    const r = await m.run(() => http(`/ledger/periods/${key}/${step}`, { method: 'POST', body: {} }))
    if (r) {
      setDone(step === 'request-close' ? `Close requested for ${periodLabel(key)}. A different accountant has to sign it off.` : `${periodLabel(key)} is closed.`)
      req.reload()
    }
  }

  return (
    <>
      <PageHeader title="Period close" subtitle="A month is closed by two people: one requests it and a different one signs it off." />
      <Notice>
        Once a period is closed nothing more can be posted into it. A mistake is fixed with a reversal entry, which is dated in the open period.
        A month can be closed once it has ended and the trial balance has no difference.
      </Notice>
      {done && <Notice kind="success">{done}</Notice>}
      {m.error != null && <ErrorMessage error={m.error} />}
      <Async req={req}>
        {(periods) => (
          <DataTable
            title="Periods"
            columns={[
              { key: 'key', header: 'Period', render: (r) => <b>{periodLabel(r.key)}</b> },
              { key: 'status', header: 'Status', render: (r) => <StatusPill kind={STATUS[r.status].kind}>{STATUS[r.status].label}</StatusPill> },
              { key: 'entries', header: 'Entries', align: 'right' },
              { key: 'debit', header: 'Debits', align: 'right', render: (r) => money(r.debit) },
              { key: 'credit', header: 'Credits', align: 'right', render: (r) => money(r.credit) },
              {
                key: 'who', header: 'Requested / closed by',
                render: (r) => r.status === 'CLOSED'
                  ? `${r.requestedByName ?? '-'} / ${r.closedByName ?? '-'}${r.closedAt ? `, ${dateTime(r.closedAt)}` : ''}`
                  : r.requestedByName ?? '-',
              },
              {
                key: 'act', header: 'Action',
                render: (r) => {
                  if (!canClose) return null
                  if (r.status === 'OPEN') {
                    return r.ended
                      ? <Button variant="row" disabled={m.busy} onClick={() => act(r.key, 'request-close')}>Request close</Button>
                      : <span className="text-sm text-muted">Not ended yet</span>
                  }
                  if (r.status === 'CLOSE_REQUESTED') {
                    return r.requestedBy === user?.id
                      ? <span className="text-sm text-muted">You requested this, so someone else signs off</span>
                      : <Button variant="row" disabled={m.busy} onClick={() => act(r.key, 'sign-off')}>Sign off</Button>
                  }
                  return null
                },
              },
            ]}
            rows={periods}
            rowKey={(r) => r.key}
            empty="No periods yet."
          />
        )}
      </Async>
    </>
  )
}
