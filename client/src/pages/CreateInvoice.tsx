import { useState } from 'react'
import Button from '../components/Button'
import Card from '../components/Card'
import { Field, SelectField } from '../components/Field'
import FormCard from '../components/FormCard'
import { Grid } from '../components/KpiRow'
import Notice from '../components/Notice'
import PageHeader from '../components/PageHeader'
import StatusPill from '../components/StatusPill'
import { useAuth } from '../auth/AuthContext'
import { inr } from '../lib/format'

const LIMIT = 3250000
const MAX_TENURE_DAYS = 90

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

export default function CreateInvoice() {
  const { action } = useAuth()
  const [buyer, setBuyer] = useState('Tata Auto Parts Ltd')
  const [number, setNumber] = useState('INV-2052')
  const [amount, setAmount] = useState('1850000')
  const [issued, setIssued] = useState('2026-11-16')
  const [due, setDue] = useState('2026-12-28')
  const [pdf, setPdf] = useState<string>('')
  const [done, setDone] = useState(false)

  const amt = Number(amount) || 0
  const tenure = issued && due ? daysBetween(issued, due) : 0
  const checks = [
    { name: 'No duplicate invoice number', ok: number.trim() !== '' && number.trim() !== 'INV-2041' },
    { name: `Amount within available limit (${inr(LIMIT)})`, ok: amt > 0 && amt <= LIMIT },
    { name: `Tenure within ${MAX_TENURE_DAYS} days (${tenure > 0 ? tenure : 0} days)`, ok: tenure > 0 && tenure <= MAX_TENURE_DAYS },
    { name: 'Invoice PDF attached', ok: pdf !== '' },
  ]
  const allOk = checks.every((c) => c.ok)
  const canCreate = action('Create invoice') === 'full'

  return (
    <>
      <PageHeader title="Create invoice" subtitle="Raise an invoice against a buyer. They will be asked to confirm it." />
      {done && <Notice kind="success">Invoice {number} submitted. The buyer has been notified to confirm it.</Notice>}
      <Grid>
        <FormCard
          title="Invoice details"
          onSubmit={() => canCreate && allOk && setDone(true)}
          buttons={
            <>
              <Button type="submit" disabled={!canCreate || !allOk}>Submit invoice</Button>
              <Button variant="secondary">Save draft</Button>
            </>
          }
        >
          <SelectField label="Buyer" value={buyer} onChange={(e) => setBuyer(e.target.value)}>
            <option>Tata Auto Parts Ltd</option>
            <option>Mahindra Logistics</option>
            <option>Bharat Forge</option>
          </SelectField>
          <Field label="Invoice number" value={number} onChange={(e) => { setNumber(e.target.value); setDone(false) }} />
          <Field label="Amount (₹)" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Issue date" type="date" value={issued} onChange={(e) => setIssued(e.target.value)} />
            <Field label="Due date" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          <Field label="Invoice PDF" type="file" accept="application/pdf" onChange={(e) => setPdf(e.target.files?.[0]?.name ?? '')} />
        </FormCard>
        <Card title="Pre-submit checks">
          <ul className="m-0 grid list-none gap-3 p-0">
            {checks.map((c) => (
              <li key={c.name} className="flex items-center justify-between gap-3">
                <span>{c.name}</span>
                <StatusPill kind={c.ok ? 'success' : 'warning'}>{c.ok ? 'Pass' : 'Pending'}</StatusPill>
              </li>
            ))}
          </ul>
          <p className="m-0 mt-4 text-sm text-muted">Buyer: {buyer}. All four checks must pass before you can submit.</p>
        </Card>
      </Grid>
    </>
  )
}
