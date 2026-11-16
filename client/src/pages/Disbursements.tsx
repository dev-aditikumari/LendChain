import { useState } from 'react'
import Button from '../components/Button'
import DataTable from '../components/DataTable'
import Notice from '../components/Notice'
import PageHeader from '../components/PageHeader'
import StatusPill from '../components/StatusPill'
import { DISBURSEMENTS, type Row } from '../data/sample'
import { useAuth } from '../auth/AuthContext'
import { inr } from '../lib/format'

export default function Disbursements() {
  const { user, action } = useAuth()
  const [rows, setRows] = useState<Row[]>(DISBURSEMENTS)
  const canExecute = action('Execute disbursement') === 'full'

  const update = (id: string, patch: Row) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  return (
    <>
      <PageHeader title="Disbursements" subtitle="Payouts waiting for authorisation." />
      <Notice>Dual control: the person who initiates a payout cannot authorise it.</Notice>
      <DataTable
        title="Payout queue"
        columns={[
          { key: 'id', header: 'Payout', render: (r) => <b>{r.id}</b> },
          { key: 'invoice', header: 'Invoice' },
          { key: 'payee', header: 'Payee' },
          { key: 'amount', header: 'Amount', align: 'right', render: (r) => inr(Number(r.amount)) },
          { key: 'initiatedBy', header: 'Initiated by' },
          { key: 'authorisedBy', header: 'Authorised by' },
          { key: 'status', header: 'Status', render: (r) => <StatusPill>{String(r.status)}</StatusPill> },
          {
            key: 'act', header: 'Action',
            render: (r) => {
              if (!canExecute) return null
              if (r.status === 'Pending') {
                const own = r.initiatedBy === user?.name
                return (
                  <Button
                    variant="row"
                    disabled={own}
                    title={own ? 'You initiated this payout' : undefined}
                    onClick={() => update(String(r.id), { status: 'Disbursed', authorisedBy: user?.name ?? '' })}
                  >
                    Authorise
                  </Button>
                )
              }
              if (r.status === 'Failed') {
                return <Button variant="row" onClick={() => update(String(r.id), { status: 'Pending', authorisedBy: '-', initiatedBy: user?.name ?? '' })}>Retry</Button>
              }
              return null
            },
          },
        ]}
        rows={rows}
      />
    </>
  )
}
