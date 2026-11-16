import { useState } from 'react'
import Button from '../components/Button'
import { Field, SelectField } from '../components/Field'
import FormCard from '../components/FormCard'
import KeyValueCard from '../components/KeyValueCard'
import { Grid } from '../components/KpiRow'
import Notice from '../components/Notice'
import PageHeader from '../components/PageHeader'
import { inr } from '../lib/format'

const INVOICE = 1850000
const RATE = 11 // % per year, from the pricing grid for band B

export default function FinancingOffer() {
  const [advance, setAdvance] = useState(90)
  const [tenure, setTenure] = useState(45)
  const [accepted, setAccepted] = useState(false)

  const adv = Math.round((INVOICE * advance) / 100)
  const discount = Math.round((adv * RATE * tenure) / (100 * 365))
  const fee = Math.max(500, Math.round(INVOICE * 0.0025))
  const net = adv - discount - fee
  const repay = new Date(Date.UTC(2026, 10, 16 + tenure)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })

  return (
    <>
      <PageHeader title="Financing offer" subtitle="Offer for INV-2041. Change the advance or tenure to see the amount you receive." />
      {accepted && <Notice kind="success">Offer accepted. The invoice has moved to review.</Notice>}
      <Grid>
        <KeyValueCard
          title="Offer breakdown"
          rows={[
            ['Invoice amount', inr(INVOICE)],
            ['Advance', `${advance}% (${inr(adv)})`],
            ['Discount rate', `${RATE}% a year`],
            ['Discount charge', inr(discount)],
            ['Processing fee', inr(fee)],
            ['Net amount to you', <span key="n" className="font-display text-[20px] font-extrabold text-violet">{inr(net)}</span>],
            ['Buyer repays on', repay],
          ]}
        />
        <FormCard
          title="Adjust offer"
          onSubmit={() => setAccepted(true)}
          buttons={<Button type="submit" disabled={accepted}>Accept offer</Button>}
        >
          <Field label="Advance (%)" type="number" min={50} max={95} value={advance} onChange={(e) => setAdvance(Math.min(95, Math.max(50, Number(e.target.value) || 50)))} hint="Between 50% and 95%." />
          <SelectField label="Tenure" value={tenure} onChange={(e) => setTenure(Number(e.target.value))}>
            <option value={30}>30 days</option>
            <option value={45}>45 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </SelectField>
        </FormCard>
      </Grid>
    </>
  )
}
