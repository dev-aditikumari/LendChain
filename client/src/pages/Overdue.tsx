import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { http } from '../api/http'
import type { Ageing, AgeBucket } from '../api/types'
import Button from '../components/Button'
import Card from '../components/Card'
import DataTable from '../components/DataTable'
import { Field, SelectField } from '../components/Field'
import PageHeader from '../components/PageHeader'
import { Async, useRequest } from '../components/RequestState'
import StatusPill from '../components/StatusPill'
import { useAuth } from '../auth/AuthContext'
import { bucketKind } from '../lib/collections'
import { money, shortDate } from '../lib/format'

const load = () => http<Ageing>('/collections/ageing')

export default function Overdue() {
  const { can } = useAuth()
  const nav = useNavigate()
  const req = useRequest(load)
  const [bucket, setBucket] = useState<'' | AgeBucket>('')
  const [q, setQ] = useState('')
  return (
    <>
      <PageHeader title="Overdue" subtitle="Every invoice past its due date, oldest first." />
      <Async req={req}>
        {({ rows }) => {
          const shown = rows.filter((r) => (!bucket || r.bucket === bucket) && (!q || `${r.number} ${r.buyer}`.toLowerCase().includes(q.toLowerCase())))
          return (
            <>
              <Card title="Filters">
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectField label="Bucket" value={bucket} onChange={(e) => setBucket(e.target.value as '' | AgeBucket)}>
                    <option value="">All buckets</option>
                    {['0-30', '31-60', '61-90', '90+'].map((b) => <option key={b} value={b}>{b} days</option>)}
                  </SelectField>
                  <Field label="Search invoice or buyer" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
              </Card>
              <DataTable
                title={`Overdue invoices (${shown.length})`}
                columns={[
                  { key: 'number', header: 'Invoice', render: (r) => <Link to={`/invoices/${r.id}`} className="font-bold text-violet">{r.number}</Link> },
                  { key: 'buyer', header: 'Buyer', render: (r) => <span>{r.buyer}{r.contactEmail && <span className="block text-xs text-muted">{r.contact} · {r.contactEmail}</span>}</span> },
                  { key: 'amount', header: 'Amount', align: 'right', render: (r) => <span className="whitespace-nowrap">{money(r.amount)}</span> },
                  { key: 'dueDate', header: 'Was due', render: (r) => shortDate(r.dueDate) },
                  { key: 'days', header: 'Days overdue', align: 'right', render: (r) => r.daysOverdue },
                  { key: 'bucket', header: 'Bucket', render: (r) => <StatusPill kind={bucketKind(r.bucket)}>{r.bucket}</StatusPill> },
                  { key: 'act', header: 'Action', render: (r) => can('collections:write') && <Button variant="row" onClick={() => nav(`/follow-ups?invoice=${r.id}`)}>Follow up</Button> },
                ]}
                rows={shown}
                rowKey={(r) => r.id}
                empty={rows.length ? 'No overdue invoice matches these filters.' : 'Nothing is overdue.'}
              />
            </>
          )
        }}
      </Async>
    </>
  )
}
