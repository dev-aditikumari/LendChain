import { useState } from 'react'
import Button from '../components/Button'
import DataTable from '../components/DataTable'
import KpiRow from '../components/KpiRow'
import PageHeader from '../components/PageHeader'
import StatusPill from '../components/StatusPill'
import { EXCEPTIONS, type Row } from '../data/sample'
import { useAuth } from '../auth/AuthContext'

export default function Exceptions() {
  const { user, can } = useAuth()
  const [rows, setRows] = useState<Row[]>(EXCEPTIONS)
  const canResolve = can('exception:resolve')
  const assign = (id: string) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, owner: user?.name ?? '' } : r)))

  return (
    <>
      <PageHeader sample title="Exceptions" subtitle="Items the automatic flow could not settle." />
      <KpiRow
        items={[
          { label: 'Open', value: String(rows.length), sub: 'Across all types', trend: '1 new today' },
          { label: 'High severity', value: String(rows.filter((r) => r.severity === 'High').length), pill: { text: 'High', kind: 'danger' }, trend: 'Needs action today' },
          { label: 'Unassigned', value: String(rows.filter((r) => r.owner === 'Unassigned').length), sub: 'No owner yet', trend: 'Pick these up first' },
          { label: 'Resolved this week', value: '17', sub: 'Median 6 hours', trend: 'Up 4 on last week' },
        ]}
      />
      <DataTable
        title="Exception list"
        columns={[
          { key: 'id', header: 'ID', render: (r) => <b>{r.id}</b> },
          { key: 'type', header: 'Type' },
          { key: 'record', header: 'Record' },
          { key: 'severity', header: 'Severity', render: (r) => <StatusPill>{String(r.severity)}</StatusPill> },
          { key: 'owner', header: 'Owner' },
          {
            key: 'act', header: 'Action',
            render: (r) => canResolve && (
              r.owner === 'Unassigned'
                ? <Button variant="row" onClick={() => assign(String(r.id))}>Assign to me</Button>
                : <Button variant="row">Open</Button>
            ),
          },
        ]}
        rows={rows}
      />
    </>
  )
}
