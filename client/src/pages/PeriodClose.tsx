import { useState } from 'react'
import Button from '../components/Button'
import Card from '../components/Card'
import DataTable from '../components/DataTable'
import KeyValueCard from '../components/KeyValueCard'
import { Grid } from '../components/KpiRow'
import Notice from '../components/Notice'
import PageHeader from '../components/PageHeader'
import Stepper from '../components/Stepper'
import StatusPill from '../components/StatusPill'
import { CLOSE_CHECKS } from '../data/sample'
import { useAuth } from '../auth/AuthContext'

const STEPS = ['Accruals', 'Reconcile', 'Review', 'Sign-off', 'Lock']

export default function PeriodClose() {
  const { can } = useAuth()
  const [locked, setLocked] = useState(false)
  const pending = CLOSE_CHECKS.filter((c) => c.status !== 'Done').length
  const canClose = can('period:close')
  return (
    <>
      <PageHeader title="Period close" subtitle="October is closed. November is in progress." actions={canClose && <Button disabled={pending > 0 || locked} onClick={() => setLocked(true)}>Request close</Button>} />
      {locked && <Notice kind="success">Close requested. It needs a second sign-off before the period locks.</Notice>}
      <Card title="Progress"><Stepper steps={STEPS} current={locked ? 3 : 2} /></Card>
      <Grid>
        <DataTable
          title="Checklist"
          columns={[
            { key: 'item', header: 'Item' },
            { key: 'owner', header: 'Owner' },
            { key: 'status', header: 'Status', render: (r) => <StatusPill>{String(r.status)}</StatusPill> },
          ]}
          rows={CLOSE_CHECKS}
        />
        <KeyValueCard
          title="Lock rules"
          rows={[
            ['After lock', 'No postings into the period'],
            ['Corrections', 'Posted in the next open period'],
            ['Sign-offs needed', 'Two, by different people'],
            ['Reopen', 'Admin only, with a reason'],
          ]}
        />
      </Grid>
    </>
  )
}
