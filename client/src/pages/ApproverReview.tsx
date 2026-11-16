import { useState } from 'react'
import Button from '../components/Button'
import DataTable from '../components/DataTable'
import { TextArea } from '../components/Field'
import FormCard from '../components/FormCard'
import KeyValueCard from '../components/KeyValueCard'
import { Grid } from '../components/KpiRow'
import Notice from '../components/Notice'
import PageHeader from '../components/PageHeader'
import StatusPill from '../components/StatusPill'
import { ENGINE_TRACE } from '../data/sample'
import { useAuth } from '../auth/AuthContext'
import { inr } from '../lib/format'

const AMOUNT = 2400000
const APPROVER_LIMIT = 2500000
const RECOMMENDED_BY = 'analyst'

export default function ApproverReview() {
  const { user, can } = useAuth()
  const [remarks, setRemarks] = useState('')
  const [outcome, setOutcome] = useState<'approved' | 'rejected' | null>(null)

  const isMaker = user?.name === RECOMMENDED_BY
  const overLimit = AMOUNT > APPROVER_LIMIT
  const canDecide = can('invoice:approve') && !isMaker && !overLimit
  const needRemarks = remarks.trim() === ''

  return (
    <>
      <PageHeader title="Review INV-2036" subtitle="Kaveri Components, billed to Tata Auto Parts Ltd." />
      <Notice kind="warning">
        Maker-checker: {RECOMMENDED_BY} recommended this invoice, so a different person must approve it.
        {isMaker && ' You made the recommendation, so you cannot decide here.'}
        {overLimit && ` The amount is above your limit of ${inr(APPROVER_LIMIT)} and must be escalated.`}
      </Notice>
      {outcome && <Notice kind={outcome === 'approved' ? 'success' : 'danger'}>Invoice INV-2036 {outcome}.</Notice>}
      <DataTable
        title="Engine trace"
        columns={[
          { key: 'rule', header: 'Rule' },
          { key: 'detail', header: 'Detail' },
          { key: 'result', header: 'Points or pass', render: (r) => <StatusPill kind={String(r.result).startsWith('-') ? 'warning' : 'success'}>{String(r.result)}</StatusPill> },
        ]}
        rows={ENGINE_TRACE}
      />
      <Grid>
        <KeyValueCard
          title="Decision"
          rows={[
            ['Score', '742 (band B)'],
            ['Invoice amount', inr(AMOUNT)],
            ['Your approval limit', inr(APPROVER_LIMIT)],
            ['Engine recommendation', <StatusPill key="e" kind="info">Approve</StatusPill>],
            ['Recommended by', RECOMMENDED_BY],
          ]}
        />
        <FormCard
          title="Remarks"
          buttons={
            <>
              <Button disabled={!canDecide || needRemarks || outcome !== null} onClick={() => setOutcome('approved')}>Approve</Button>
              <Button variant="danger" disabled={!canDecide || needRemarks || outcome !== null} onClick={() => setOutcome('rejected')}>Reject</Button>
            </>
          }
        >
          <TextArea label="Remarks (required)" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </FormCard>
      </Grid>
    </>
  )
}
