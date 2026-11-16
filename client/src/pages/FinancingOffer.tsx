import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { http } from '../api/http'
import type { Evaluation, Invoice, InvoicePage } from '../api/types'
import Button from '../components/Button'
import EngineTrace from '../components/EngineTrace'
import { Field, SelectField } from '../components/Field'
import FormCard from '../components/FormCard'
import KeyValueCard from '../components/KeyValueCard'
import { Grid } from '../components/KpiRow'
import Notice from '../components/Notice'
import PageHeader from '../components/PageHeader'
import { Async, ErrorMessage, useMutation, useRequest } from '../components/RequestState'
import { money } from '../lib/format'

const load = () => http<InvoicePage>('/invoices?status=BUYER_CONFIRMED&limit=100')

interface Outcome { invoice: Invoice; evaluation: Evaluation }

function Form({ invoices }: { invoices: Invoice[] }) {
  const [params] = useSearchParams()
  const m = useMutation()
  const [invoiceId, setInvoiceId] = useState(params.get('invoice') ?? invoices[0]?._id ?? '')
  const [advance, setAdvance] = useState('')
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  const request = async () => {
    const r = await m.run(() =>
      http<Outcome>(`/invoices/${invoiceId}/financing-requests`, {
        body: advance ? { advancePercent: Number(advance) } : {},
      }),
    )
    if (r) setOutcome(r)
  }

  if (invoices.length === 0 && !outcome) {
    return <Notice>No invoice is waiting for financing. An invoice shows up here once the buyer has confirmed it.</Notice>
  }

  const inv = outcome?.invoice
  const res = outcome?.evaluation.result
  return (
    <>
      <Grid>
        <FormCard
          title="Request financing"
          onSubmit={request}
          buttons={<Button type="submit" disabled={!invoiceId || m.busy || !!outcome}>{m.busy ? 'Requesting...' : 'Request financing'}</Button>}
        >
          <SelectField label="Invoice" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} disabled={!!outcome}>
            {invoices.map((i) => <option key={i._id} value={i._id}>{i.number} ({money(i.amount)}, {i.buyerName})</option>)}
          </SelectField>
          <Field
            label="Advance (%), optional"
            type="number" min={1} max={100}
            value={advance} onChange={(e) => setAdvance(e.target.value)}
            hint="Leave blank to use the program default. The rule engine may lower it."
            disabled={!!outcome}
          />
          {m.error ? <ErrorMessage error={m.error} /> : null}
        </FormCard>
        {inv && res && (
          <KeyValueCard
            title="Offer"
            rows={
              res.decision === 'REJECT'
                ? [['Result', 'Rejected by the rule engine'], ['Reasons', res.reasons.join(', ') || '-']]
                : [
                    ['Invoice amount', money(inv.amount)],
                    ['Advance', `${res.advancePercent}% (${money(inv.financedAmount)})`],
                    ['Discount rate', `${res.rate}% a year`],
                    ['Fee', money(res.fee)],
                    ['Next step', 'Sent for credit review'],
                  ]
            }
          />
        )}
      </Grid>
      {outcome && <EngineTrace evaluation={outcome.evaluation} />}
    </>
  )
}

export default function FinancingOffer() {
  const req = useRequest(load)
  return (
    <>
      <PageHeader title="Financing" subtitle="Ask for an advance against a confirmed invoice. The rule engine prices it straight away." />
      <Async req={req}>{(page) => <Form invoices={page.items} />}</Async>
    </>
  )
}
