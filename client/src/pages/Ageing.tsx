import { Link, useNavigate } from 'react-router-dom'
import { http } from '../api/http'
import type { Ageing as AgeingData, AgeBucket } from '../api/types'
import Button from '../components/Button'
import DataTable from '../components/DataTable'
import KpiRow from '../components/KpiRow'
import PageHeader from '../components/PageHeader'
import { Async, useRequest } from '../components/RequestState'
import StatusPill from '../components/StatusPill'
import { useAuth } from '../auth/AuthContext'
import { money, shortDate } from '../lib/format'
import { BUCKET_ACTION, bucketKind } from '../lib/collections'

const load = () => http<AgeingData>('/collections/ageing')
const BUCKETS: AgeBucket[] = ['0-30', '31-60', '61-90', '90+']
const plural = (n: number) => `${n} invoice${n === 1 ? '' : 's'}`

export default function Ageing() {
  const { can } = useAuth()
  const nav = useNavigate()
  const req = useRequest(load)
  const canFollow = can('collections:write')
  return (
    <>
      <PageHeader title="Ageing" subtitle="Overdue amounts grouped by days past due." />
      <Async req={req}>
        {({ buckets, rows }) => (
          <>
            <KpiRow
              items={BUCKETS.map((b) => ({
                label: `${b} days`,
                value: money(buckets[b].amount),
                sub: plural(buckets[b].count),
                ...(b === '90+' && buckets[b].count > 0 ? { pill: { text: 'High', kind: 'danger' as const } } : {}),
                trend: BUCKET_ACTION[b],
              }))}
            />
            <DataTable
              title="Overdue invoices"
              columns={[
                { key: 'number', header: 'Invoice', render: (r) => <Link to={`/invoices/${r.id}`} className="font-bold text-violet">{r.number}</Link> },
                { key: 'buyer', header: 'Buyer' },
                { key: 'amount', header: 'Amount', align: 'right', render: (r) => <span className="whitespace-nowrap">{money(r.amount)}</span> },
                { key: 'daysOverdue', header: 'Days overdue', align: 'right' },
                { key: 'bucket', header: 'Bucket', render: (r) => <StatusPill kind={bucketKind(r.bucket)}>{r.bucket}</StatusPill> },
                { key: 'contact', header: 'Contact', render: (r) => r.contact ?? 'Not recorded' },
                { key: 'last', header: 'Last follow-up', render: (r) => (r.lastFollowUp ? shortDate(r.lastFollowUp) : 'None yet') },
                { key: 'act', header: 'Action', render: (r) => canFollow && <Button variant="row" onClick={() => nav(`/follow-ups?invoice=${r.id}`)}>Follow up</Button> },
              ]}
              rows={rows}
              rowKey={(r) => r.id}
              empty="Nothing is overdue. Every paid-out invoice is within its due date."
            />
          </>
        )}
      </Async>
    </>
  )
}
