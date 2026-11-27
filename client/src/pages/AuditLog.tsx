import { useMemo, useState } from 'react'
import { http } from '../api/http'
import Card from '../components/Card'
import DataTable from '../components/DataTable'
import { Field, SelectField } from '../components/Field'
import PageHeader from '../components/PageHeader'
import { ErrorMessage, useRequest } from '../components/RequestState'

interface AuditEntry {
  _id: string
  createdAt: string
  actor?: { name: string } | null
  action: string
  target: string
  after?: unknown
}

const AREAS = [
  ['', 'All actions'], ['invoice', 'Invoices'], ['disbursement', 'Disbursements'], ['repayment', 'Repayments'], ['rule', 'Rule sets'],
  ['ledger', 'Ledger'], ['period', 'Period close'], ['followup', 'Follow-ups'], ['user', 'Users'], ['entity', 'Companies'],
] as const

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function AuditLog() {
  const [area, setArea] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [user, setUser] = useState('')
  const [q, setQ] = useState('')
  const query = new URLSearchParams({
    ...(area && { action: area }),
    ...(from && { from: new Date(from).toISOString() }),
    ...(to && { to: new Date(`${to}T23:59:59.999`).toISOString() }),
    limit: '500',
  }).toString()
  const { data, error, loading } = useRequest(() => http<AuditEntry[]>(`/audit-logs?${query}`), query)

  const rows = useMemo(
    () =>
      (data ?? []).map((a) => ({
        id: a._id,
        time: when(a.createdAt),
        user: a.actor?.name ?? 'system',
        action: a.action,
        record: a.target,
        change: a.after ? JSON.stringify(a.after) : '',
      })),
    [data],
  )
  const users = useMemo(() => [...new Set(rows.map((r) => r.user))], [rows])
  const shown = rows.filter(
    (r) => (!user || r.user === user) && (!q || `${r.action} ${r.record} ${r.change}`.toLowerCase().includes(q.toLowerCase())),
  )

  return (
    <>
      <PageHeader title="Audit log" subtitle="Every change, who made it and when." />
      {error ? <ErrorMessage page error={error} /> : null}
      {!error && (
        <>
          <Card title="Filters">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <SelectField label="Area" value={area} onChange={(e) => setArea(e.target.value)}>
                {AREAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </SelectField>
              <Field label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <Field label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              <SelectField label="User" value={user} onChange={(e) => setUser(e.target.value)}>
                <option value="">All users</option>
                {users.map((u) => <option key={u}>{u}</option>)}
              </SelectField>
              <Field label="Search action, record or change" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </Card>
          <DataTable
            title={`Events (${shown.length})`}
            columns={[
              { key: 'time', header: 'Time' },
              { key: 'user', header: 'User' },
              { key: 'action', header: 'Action' },
              { key: 'record', header: 'Record' },
              { key: 'change', header: 'Change' },
            ]}
            rows={shown}
            rowKey={(r) => r.id}
            empty={loading ? 'Loading...' : 'No events match these filters.'}
          />
        </>
      )}
    </>
  )
}
