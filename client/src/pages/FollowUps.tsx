import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { http } from '../api/http'
import type { Ageing, FollowUpRow } from '../api/types'
import Button from '../components/Button'
import DataTable from '../components/DataTable'
import { Field, SelectField, TextArea } from '../components/Field'
import FormCard from '../components/FormCard'
import KpiRow from '../components/KpiRow'
import Notice from '../components/Notice'
import PageHeader from '../components/PageHeader'
import { Async, ErrorMessage, useMutation, useRequest } from '../components/RequestState'
import StatusPill from '../components/StatusPill'
import { useAuth } from '../auth/AuthContext'
import { CHANNEL_LABEL } from '../lib/collections'
import { money, shortDate, toPaise } from '../lib/format'

const loadFollowUps = () => http<FollowUpRow[]>('/collections/follow-ups')
const loadOverdue = () => http<Ageing>('/collections/ageing')

export default function FollowUps() {
  const { can } = useAuth()
  const [params, setParams] = useSearchParams()
  const list = useRequest(loadFollowUps)
  const overdue = useRequest(loadOverdue)
  const m = useMutation()
  const [tab, setTab] = useState<'OPEN' | 'DONE'>('OPEN')
  const [channel, setChannel] = useState('CALL')
  const [note, setNote] = useState('')
  const [promisedOn, setPromisedOn] = useState('')
  const [promisedRupees, setPromisedRupees] = useState('')
  const [nextOn, setNextOn] = useState('')
  const [invoiceId, setInvoiceId] = useState(params.get('invoice') ?? '')
  const [done, setDone] = useState('')
  const canWrite = can('collections:write')

  const reset = () => { setNote(''); setPromisedOn(''); setPromisedRupees(''); setNextOn(''); setChannel('CALL') }
  const save = async () => {
    setDone('')
    const body: Record<string, unknown> = { invoiceId, channel, note }
    if (promisedOn) body.promisedOn = promisedOn
    if (promisedRupees) body.promisedAmount = toPaise(Number(promisedRupees))
    if (nextOn) body.nextOn = nextOn
    const r = await m.run(() => http('/collections/follow-ups', { body }))
    if (r !== undefined) {
      setDone(nextOn ? 'Follow-up saved. It stays open until you mark it done.' : 'Note saved.')
      reset()
      setInvoiceId('')
      setParams({}, { replace: true })
      list.reload()
      overdue.reload()
    }
  }
  const finish = async (id: string) => {
    setDone('')
    const r = await m.run(() => http(`/collections/follow-ups/${id}/done`, { body: {} }))
    if (r !== undefined) { setDone('Marked done.'); list.reload(); overdue.reload() }
  }

  return (
    <>
      <PageHeader title="Follow-ups" subtitle="Calls, emails and visits to get overdue invoices paid." />
      <Async req={list}>
        {(all) => {
          const open = all.filter((f) => f.status === 'OPEN')
          const today = Date.now()
          const late = open.filter((f) => f.nextOn && new Date(f.nextOn).getTime() < today)
          const promised = open.reduce((s, f) => s + (f.promisedAmount ?? 0), 0)
          const rows = all.filter((f) => f.status === tab)
          return (
            <>
              <KpiRow
                items={[
                  { label: 'Open', value: String(open.length), sub: 'Still to do', trend: 'Newest first' },
                  { label: 'Past their date', value: String(late.length), pill: late.length ? { text: 'Late', kind: 'danger' } : undefined, sub: late.length ? undefined : 'None late', trend: 'Do these first' },
                  { label: 'Promised to pay', value: money(promised), sub: 'On open follow-ups', trend: 'What buyers said they would pay' },
                  { label: 'Done', value: String(all.length - open.length), sub: 'Closed so far', trend: 'Kept for the record' },
                ]}
              />
              {done && <Notice kind="success">{done}</Notice>}
              {m.error != null && <ErrorMessage error={m.error} />}
              {canWrite && (
                <FormCard
                  title="Record a follow-up"
                  onSubmit={save}
                  buttons={<Button type="submit" disabled={m.busy || !invoiceId}>{m.busy ? 'Saving...' : 'Save follow-up'}</Button>}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <SelectField label="Overdue invoice" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} required>
                      <option value="">{overdue.data && overdue.data.rows.length === 0 ? 'Nothing is overdue' : 'Choose an invoice'}</option>
                      {overdue.data?.rows.map((r) => <option key={r.id} value={r.id}>{r.number} · {r.buyer} · {r.daysOverdue} days</option>)}
                    </SelectField>
                    <SelectField label="How did you reach them?" value={channel} onChange={(e) => setChannel(e.target.value)}>
                      {Object.entries(CHANNEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </SelectField>
                  </div>
                  <TextArea label="What happened" value={note} onChange={(e) => setNote(e.target.value)} required placeholder="For example: Spoke to the finance head, payment is with their approver" />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Promised date (optional)" type="date" value={promisedOn} onChange={(e) => setPromisedOn(e.target.value)} />
                    <Field label="Promised amount in rupees (optional)" type="number" min="1" value={promisedRupees} onChange={(e) => setPromisedRupees(e.target.value)} />
                    <Field label="Look again on (optional)" type="date" value={nextOn} onChange={(e) => setNextOn(e.target.value)} hint="Leave empty if there is nothing more to do" />
                  </div>
                </FormCard>
              )}
              <div role="tablist" className="flex gap-2">
                {(['OPEN', 'DONE'] as const).map((t) => (
                  <Button key={t} variant={tab === t ? 'primary' : 'secondary'} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
                    {t === 'OPEN' ? `Open (${open.length})` : `Done (${all.length - open.length})`}
                  </Button>
                ))}
              </div>
              <DataTable
                title={tab === 'OPEN' ? 'Open follow-ups' : 'Finished follow-ups'}
                columns={[
                  { key: 'number', header: 'Invoice', render: (r) => <Link to={`/invoices/${r.invoiceId}`} className="font-bold text-violet">{r.number}</Link> },
                  { key: 'channel', header: 'How', render: (r) => CHANNEL_LABEL[r.channel] },
                  { key: 'note', header: 'What happened', render: (r) => <span>{r.note}{r.promisedOn && <span className="block text-xs text-muted">Promised {shortDate(r.promisedOn)}{r.promisedAmount ? ` · ${money(r.promisedAmount)}` : ''}</span>}</span> },
                  { key: 'by', header: 'By' },
                  { key: 'createdAt', header: 'Logged', render: (r) => shortDate(r.createdAt) },
                  { key: 'nextOn', header: 'Look again', render: (r) => (r.nextOn ? <span>{shortDate(r.nextOn)} {r.status === 'OPEN' && new Date(r.nextOn).getTime() < today && <StatusPill kind="danger">Late</StatusPill>}</span> : '-') },
                  { key: 'act', header: 'Action', render: (r) => canWrite && r.status === 'OPEN' && <Button variant="row" disabled={m.busy} onClick={() => finish(r.id)}>Mark done</Button> },
                ]}
                rows={rows}
                rowKey={(r) => r.id}
                empty={tab === 'OPEN' ? 'Nothing waiting. Record a follow-up above.' : 'Nothing has been finished yet.'}
              />
            </>
          )
        }}
      </Async>
    </>
  )
}
