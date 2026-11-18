import { Link } from 'react-router-dom'
import { http } from '../api/http'
import type { Disbursement, ExceptionRow } from '../api/types'
import DataTable from '../components/DataTable'
import KpiRow from '../components/KpiRow'
import PageHeader from '../components/PageHeader'
import { Async, useRequest } from '../components/RequestState'
import StatusPill, { type PillKind } from '../components/StatusPill'
import { dateTime, money } from '../lib/format'

const load = () =>
  Promise.all([http<Disbursement[]>('/disbursements'), http<ExceptionRow[]>('/exceptions?status=OPEN')]).then(([payouts, open]) => ({ payouts, open }))

const HOUR = 3600000

function age(iso: string) {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / HOUR)
  return h < 1 ? 'Under an hour' : h < 48 ? `${h} h` : `${Math.floor(h / 24)} days`
}

function state(p: Disbursement): { label: string; kind: PillKind; note: string } {
  if (p.status === 'FAILED') return { label: 'Refused', kind: 'danger', note: p.failureReason ?? 'The bank refused the transfer' }
  if (p.status === 'PENDING_AUTH') return { label: 'Waiting to be released', kind: 'warning', note: `Queued by ${p.initiatedBy?.name ?? '-'}` }
  if (p.bankStatus === 'FAILED') return { label: 'Bank reports failed', kind: 'danger', note: p.failureReason ?? 'Reported after release' }
  if (p.bankStatus === 'CONFIRMED') return { label: 'Confirmed by bank', kind: 'success', note: p.reference ?? '' }
  return { label: 'Sent, no bank message yet', kind: 'info', note: p.reference ?? '' }
}

export default function PayoutMonitor() {
  const req = useRequest(load)
  return (
    <>
      <PageHeader title="Payout monitor" subtitle="Where every payout stands, from the queue to the bank's confirmation." />
      <Async req={req}>
        {({ payouts, open }) => {
          const waiting = payouts.filter((p) => p.status === 'PENDING_AUTH')
          const stale = waiting.filter((p) => Date.now() - new Date(p.createdAt).getTime() > HOUR).length
          const sent = payouts.filter((p) => p.status === 'SUCCESS')
          const bad = payouts.filter((p) => p.status === 'FAILED' || p.bankStatus === 'FAILED')
          return (
            <>
              <KpiRow
                items={[
                  { label: 'Waiting to be released', value: String(waiting.length), sub: stale ? `${stale} waiting over an hour` : 'None waiting long', trend: 'A second person releases them' },
                  { label: 'Sent', value: String(sent.length), sub: `${sent.filter((p) => p.bankStatus === 'CONFIRMED').length} confirmed by the bank`, trend: 'Confirmations arrive by webhook' },
                  { label: 'Refused or failed', value: String(bad.length), pill: bad.length ? { text: 'Needs action', kind: 'danger' } : { text: 'None', kind: 'success' }, trend: 'See the exception queue' },
                  { label: 'Open exceptions', value: String(open.length), sub: open.length ? 'Waiting for Operations' : 'All clear', trend: 'Payouts and bank messages' },
                ]}
              />
              <DataTable
                title="Payouts"
                action={open.length > 0 ? <Link to="/exceptions" className="text-sm font-bold text-violet">Open exceptions ({open.length})</Link> : undefined}
                columns={[
                  { key: 'invoice', header: 'Invoice', render: (r) => <b>{r.invoiceId?.number ?? '-'}</b> },
                  { key: 'payee', header: 'Payee', render: (r) => r.invoiceId?.supplierId?.legalName ?? '-' },
                  { key: 'amount', header: 'Amount', align: 'right', render: (r) => money(r.net ?? r.amount) },
                  { key: 'state', header: 'State', render: (r) => <span><StatusPill kind={state(r).kind}>{state(r).label}</StatusPill><span className="mt-1 block text-xs text-muted">{state(r).note}</span></span> },
                  { key: 'createdAt', header: 'Queued', render: (r) => <span title={dateTime(r.createdAt)}>{age(r.createdAt)}</span> },
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
