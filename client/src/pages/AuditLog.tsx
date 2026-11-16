import { useMemo, useState } from 'react'
import Card from '../components/Card'
import DataTable from '../components/DataTable'
import { Field, SelectField } from '../components/Field'
import PageHeader from '../components/PageHeader'
import { AUDIT } from '../data/sample'

export default function AuditLog() {
  const [user, setUser] = useState('')
  const [q, setQ] = useState('')
  const users = useMemo(() => [...new Set(AUDIT.map((a) => String(a.user)))], [])
  const rows = AUDIT.filter(
    (a) => (!user || a.user === user) && (!q || `${a.action} ${a.record} ${a.change}`.toLowerCase().includes(q.toLowerCase())),
  )
  return (
    <>
      <PageHeader title="Audit log" subtitle="Every change, who made it and when." />
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
        rows={rows}
        empty="No events match these filters."
      />
    </>
  )
}
