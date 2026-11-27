import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { http } from '../api/http'
import type { Notification } from '../api/types'
import DataTable from '../components/DataTable'
import PageHeader from '../components/PageHeader'
import { Async, useRequest } from '../components/RequestState'
import { dateTime } from '../lib/format'
import { statusLabel } from '../lib/invoiceStatus'
import StatusPill from '../components/StatusPill'
import { markNotificationsRead } from '../lib/unread'

const load = () => http<Notification[]>('/notifications')

export default function Notifications() {
  const req = useRequest(load)
  // what was new is shown highlighted on this visit, then counted as read
  useEffect(() => {
    if (req.data?.some((n) => n.unread)) void markNotificationsRead()
  }, [req.data])
  return (
    <>
      <PageHeader title="Notifications" subtitle="Recent changes on your invoices." />
      <Async req={req}>
        {(rows) => (
          <DataTable
            title="Recent activity"
            columns={[
              { key: 'at', header: 'When', render: (r) => <span>{dateTime(r.at)} {r.unread && <StatusPill kind="info">New</StatusPill>}</span> },
              { key: 'number', header: 'Invoice', render: (r) => <Link to={`/invoices/${r.invoiceId}`} className="font-bold text-violet">{r.number}</Link> },
              { key: 'to', header: 'Now', render: (r) => statusLabel(r.to) },
              { key: 'by', header: 'By' },
              { key: 'note', header: 'Note' },
            ]}
            rows={rows}
            rowKey={(r) => r.id}
            empty="Nothing has happened yet."
          />
        )}
      </Async>
    </>
  )
}
