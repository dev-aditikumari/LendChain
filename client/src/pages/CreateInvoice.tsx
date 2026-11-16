import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { http } from '../api/http'
import type { Invoice, Program } from '../api/types'
import Button from '../components/Button'
import Card from '../components/Card'
import { Field, SelectField } from '../components/Field'
import FormCard from '../components/FormCard'
import { Grid } from '../components/KpiRow'
import PageHeader from '../components/PageHeader'
import { Async, ErrorMessage, useMutation, useRequest } from '../components/RequestState'
import StatusPill from '../components/StatusPill'
import { money, toPaise } from '../lib/format'

const load = () => http<Program[]>('/programs')

const today = () => new Date().toISOString().slice(0, 10)
const days = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)

function Form({ programs }: { programs: Program[] }) {
  const nav = useNavigate()
  const m = useMutation()
  const [programId, setProgramId] = useState(programs[0]?._id ?? '')
  const [number, setNumber] = useState('')
  const [amount, setAmount] = useState('')
  const [issued, setIssued] = useState(today())
  const [due, setDue] = useState('')

  const program = programs.find((p) => p._id === programId)
  const amt = Number(amount) || 0
  const tenure = issued && due ? days(issued, due) : 0
  const available = program ? program.sanctioned - program.outstanding : 0
  const checks = [
    { name: 'Invoice number entered', ok: number.trim() !== '' },
    { name: `Amount within available limit (${money(available)})`, ok: amt > 0 && toPaise(amt) <= available },
    { name: `Due date after issue date, within ${program?.maxTenureDays ?? 90} days (${Math.max(tenure, 0)} days)`, ok: tenure > 0 && tenure <= (program?.maxTenureDays ?? 90) },
  ]
  const allOk = checks.every((c) => c.ok)

  const submit = async () => {
    const id = await m.run(async () => {
      const inv = await http<Invoice>('/invoices', {
        body: { number: number.trim(), buyerId: program!.buyerId, amount: toPaise(amt), issueDate: issued, dueDate: due },
      })
      await http(`/invoices/${inv._id}/submit`, { method: 'POST', body: {} })
      return inv._id
    })
    if (id) nav(`/invoices/${id}`)
  }

  if (programs.length === 0) {
    return <Card title="No program yet"><p className="m-0 text-muted">You have no financing program with a buyer, so you cannot raise an invoice. Ask an admin to set one up.</p></Card>
  }

  return (
    <Grid>
      <FormCard
        title="Invoice details"
        onSubmit={submit}
        buttons={<Button type="submit" disabled={!allOk || m.busy}>{m.busy ? 'Submitting...' : 'Submit invoice'}</Button>}
      >
        <SelectField label="Buyer" value={programId} onChange={(e) => setProgramId(e.target.value)}>
          {programs.map((p) => <option key={p._id} value={p._id}>{p.buyerName}</option>)}
        </SelectField>
        <Field label="Invoice number" value={number} onChange={(e) => setNumber(e.target.value)} />
        <Field label="Amount (₹)" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Issue date" type="date" value={issued} onChange={(e) => setIssued(e.target.value)} />
          <Field label="Due date" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        {m.error ? <ErrorMessage error={m.error} /> : null}
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
        <p className="m-0 mt-4 text-sm text-muted">The server also checks for a duplicate of the same invoice when you submit.</p>
      </Card>
    </Grid>
  )
}

export default function CreateInvoice() {
  const req = useRequest(load)
  return (
    <>
      <PageHeader title="Create invoice" subtitle="Raise an invoice against a buyer. They will be asked to confirm it." />
      <Async req={req}>{(programs) => <Form programs={programs} />}</Async>
    </>
  )
}
