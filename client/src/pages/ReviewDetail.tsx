import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { http } from '../api/http'
import type { InvoiceDetailResponse } from '../api/types'
import Button from '../components/Button'
import EngineTrace from '../components/EngineTrace'
import { TextArea } from '../components/Field'
import FormCard from '../components/FormCard'
import KeyValueCard from '../components/KeyValueCard'
import { Grid } from '../components/KpiRow'
import Notice from '../components/Notice'
import PageHeader from '../components/PageHeader'
import { Async, ErrorMessage, useMutation, useRequest } from '../components/RequestState'
import StatusPill from '../components/StatusPill'
import { useAuth } from '../auth/AuthContext'
import { money, shortDate } from '../lib/format'
import { statusKind, statusLabel } from '../lib/invoiceStatus'

export default function ReviewDetail() {
  const { id = '' } = useParams()
  const { can } = useAuth()
  const req = useRequest(() => http<InvoiceDetailResponse>(`/invoices/${id}`), id)
  const m = useMutation()
  const [text, setText] = useState('')
  const [done, setDone] = useState('')

  // the server decides who may do this; the screen sends the request and shows its answer
  const send = async (path: string, body: object, message: string) => {
    const r = await m.run(() => http(path, { body }))
    if (r !== undefined) {
      setDone(message)
      setText('')
      req.reload()
    }
  }
  const tooShort = text.trim().length < 3

  return (
    <Async req={req}>
      {({ invoice: inv, evaluation }) => (
        <>
          <PageHeader
            title={`Review ${inv.number}`}
            subtitle={`${inv.supplierName}, billed to ${inv.buyerName}.`}
            actions={<StatusPill kind={statusKind(inv.status)}>{statusLabel(inv.status)}</StatusPill>}
          />
          <Notice kind="warning">
            Maker-checker: whoever recommends an invoice cannot approve it, and the amount must be within the approver's limit.
          </Notice>
          {done && <Notice kind="success">{done}</Notice>}
          {evaluation && <EngineTrace evaluation={evaluation} />}
          <Grid>
            <KeyValueCard
              title="Decision"
              rows={[
                ['Invoice amount', money(inv.amount)],
                ['Financed amount', money(inv.financedAmount)],
                ['Due date', shortDate(inv.dueDate)],
                ['Analyst recommendation', inv.recommendation ? <StatusPill key="r" kind="info">{inv.recommendation}</StatusPill> : 'Not yet given'],
              ]}
            />
            {inv.status === 'ENGINE_EVALUATED' && (can('credit:review') || can('invoice:approve')) && (
              <FormCard
                title={can('invoice:approve') ? 'Decision' : 'Recommendation'}
                buttons={
                  can('invoice:approve') ? (
                    <>
                      <Button disabled={tooShort || m.busy} onClick={() => send(`/approvals/${inv._id}/decision`, { decision: 'APPROVE', remarks: text.trim() }, 'Invoice approved.')}>Approve</Button>
                      <Button variant="danger" disabled={tooShort || m.busy} onClick={() => send(`/approvals/${inv._id}/decision`, { decision: 'REJECT', remarks: text.trim() }, 'Invoice rejected.')}>Reject</Button>
                    </>
                  ) : (
                    <>
                      <Button disabled={tooShort || m.busy} onClick={() => send(`/approvals/${inv._id}/recommend`, { recommendation: 'APPROVE', notes: text.trim() }, 'Recommendation saved: approve.')}>Recommend approve</Button>
                      <Button variant="danger" disabled={tooShort || m.busy} onClick={() => send(`/approvals/${inv._id}/recommend`, { recommendation: 'REJECT', notes: text.trim() }, 'Recommendation saved: reject.')}>Recommend reject</Button>
                    </>
                  )
                }
              >
                <TextArea label="Remarks (required)" value={text} onChange={(e) => setText(e.target.value)} />
                {m.error ? <ErrorMessage error={m.error} /> : null}
              </FormCard>
            )}
          </Grid>
        </>
      )}
    </Async>
  )
}
