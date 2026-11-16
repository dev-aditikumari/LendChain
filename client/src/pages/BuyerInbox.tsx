import { useState } from 'react'
import Button from '../components/Button'
import DataTable from '../components/DataTable'
import KpiRow from '../components/KpiRow'
import PageHeader from '../components/PageHeader'
import StatusPill from '../components/StatusPill'
import { BUYER_INBOX, type Row } from '../data/sample'
import { useAuth } from '../auth/AuthContext'
import { inr } from '../lib/format'

export default function BuyerInbox() {
  const { action } = useAuth()
  const [rows, setRows] = useState<Row[]>(BUYER_INBOX)
  const canAct = action('Confirm / dispute') === 'full'
  const set = (id: string, status: string) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)))

  const waiting = rows.filter((r) => r.status === 'Awaiting you')
  const waitingTotal = waiting.reduce((s, r) => s + Number(r.amount), 0)

  return (
    <>
      <PageHeader title="Invoice inbox" subtitle="Invoices addressed to you. Confirm the ones you agree to pay." />
      <KpiRow
        items={[
          { label: 'Awaiting you', value: String(waiting.length), sub: inr(waitingTotal), trend: 'Confirm within 3 working days' },
          { label: 'Confirmed this month', value: '14', sub: '₹46.2 L', trend: 'Up 3 on October' },
          { label: 'Disputed', value: String(rows.filter((r) => r.status === 'Disputed').length), pill: { text: 'Disputed', kind: 'danger' }, trend: 'Financing paused on these' },
          { label: 'Due in 7 days', value: '₹9.2 L', sub: '2 invoices', trend: 'Repay via your payables screen' },
        ]}
      />
      <DataTable
        title="Inbox"
        columns={[
          { key: 'id', header: 'Invoice', render: (r) => <b>{r.id}</b> },
          { key: 'supplier', header: 'Supplier' },
          { key: 'amount', header: 'Amount', align: 'right', render: (r) => inr(Number(r.amount)) },
          { key: 'due', header: 'Due' },
          { key: 'status', header: 'Status', render: (r) => <StatusPill>{String(r.status)}</StatusPill> },
          {
            key: 'act', header: 'Action',
            render: (r) =>
              canAct && r.status === 'Awaiting you' ? (
                <span className="flex gap-2">
                  <Button variant="row" onClick={() => set(String(r.id), 'Confirmed')}>Accept</Button>
                  <Button variant="row" onClick={() => set(String(r.id), 'Disputed')}>Dispute</Button>
                </span>
              ) : null,
          },
        ]}
        rows={rows}
      />
    </>
  )
}
