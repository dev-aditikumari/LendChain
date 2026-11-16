import { Link, useParams } from 'react-router-dom'
import { http } from '../api/http'
import type { InvoiceDetailResponse } from '../api/types'
import Button from '../components/Button'
import Card from '../components/Card'
import EngineTrace from '../components/EngineTrace'
import KeyValueCard from '../components/KeyValueCard'
import { Grid } from '../components/KpiRow'
import Notice from '../components/Notice'
import PageHeader from '../components/PageHeader'
import { Async, ErrorMessage, useMutation, useRequest } from '../components/RequestState'
import Stepper from '../components/Stepper'
import StatusPill from '../components/StatusPill'
import Timeline from '../components/Timeline'
import { useAuth } from '../auth/AuthContext'
import { dateTime, money, shortDate } from '../lib/format'
import { PATH_LABELS, statusKind, statusLabel, stepIndex } from '../lib/invoiceStatus'

export default function InvoiceDetail() {
  const { id = '' } = useParams()
  const { can } = useAuth()
  const req = useRequest(() => http<InvoiceDetailResponse>(`/invoices/${id}`), id)
  const m = useMutation()

  const submit = async () => {
    await m.run(() => http(`/invoices/${id}/submit`, { method: 'POST', body: {} }))
    req.reload()
  }

  return (
    <Async req={req}>
      {({ invoice: inv, events, evaluation }) => (
        <>
          <PageHeader
            title={`Invoice ${inv.number}`}
            subtitle={`Raised by ${inv.supplierName} against ${inv.buyerName}.`}
            actions={<StatusPill kind={statusKind(inv.status)}>{statusLabel(inv.status)}</StatusPill>}
          />
          {inv.status === 'DISPUTED' && <Notice kind="danger">Disputed by the buyer: {inv.disputeReason}</Notice>}
          {inv.status === 'REJECTED' && <Notice kind="danger">This invoice was rejected{events.at(-1)?.note ? `: ${events.at(-1)!.note}` : '.'}</Notice>}
          {m.error ? <ErrorMessage error={m.error} /> : null}
          {(inv.status === 'DRAFT' && can('invoice:submit')) || (inv.status === 'BUYER_CONFIRMED' && can('financing:request')) ? (
            <div className="flex gap-3">
              {inv.status === 'DRAFT' && <Button onClick={submit} disabled={m.busy}>Submit to buyer</Button>}
              {inv.status === 'BUYER_CONFIRMED' && <Link to={`/financing?invoice=${inv._id}`}><Button>Request financing</Button></Link>}
            </div>
          ) : null}
          <Card title="Progress"><Stepper steps={PATH_LABELS} current={stepIndex(inv.status)} /></Card>
          <Grid>
            <KeyValueCard
              title="Invoice details"
              rows={[
                ['Buyer', inv.buyerName ?? '-'],
                ['Amount', money(inv.amount)],
                ['Issue date', shortDate(inv.issueDate)],
                ['Due date', shortDate(inv.dueDate)],
                ['Advance', inv.advancePercent ? `${inv.advancePercent}%` : '-'],
                ['Financed amount', inv.financedAmount ? money(inv.financedAmount) : '-'],
                ['Tenure', inv.tenureDays ? `${inv.tenureDays} days` : '-'],
              ]}
            />
            <Card title="Activity">
              <Timeline
                items={events.map((e) => ({
                  event: statusLabel(e.to),
                  detail: `${dateTime(e.createdAt)} by ${e.actor?.name ?? 'system'}${e.note ? `, ${e.note}` : ''}`,
                }))}
              />
            </Card>
          </Grid>
          {evaluation && <EngineTrace evaluation={evaluation} />}
        </>
      )}
    </Async>
  )
}
