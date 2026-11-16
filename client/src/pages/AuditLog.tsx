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

const load = () => http<AuditEntry[]>('/audit-logs')

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function AuditLog() {
  const { data, error, loading } = useRequest(load)
  const [user, setUser] = useState('')
  const [q, setQ] = useState('')

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
      {error ? <ErrorMessage error={error} /> : null}
      {!error && (
        <>
          <Card title="Filters">
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField label="User" value={user} onChange={(e) => setUser(e.target.value)}>
                <option value="">All users</option>
                {users.map((u) => <option key={u}>{u}</option>)}
              </SelectField>
              <Field label="Search action, record or change" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </Card>
          <DataTable
            title="Events"
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
