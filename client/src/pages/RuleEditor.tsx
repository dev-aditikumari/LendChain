import { useState } from 'react'
import Button from '../components/Button'
import Card from '../components/Card'
import DataTable from '../components/DataTable'
import { Grid } from '../components/KpiRow'
import Notice from '../components/Notice'
import PageHeader from '../components/PageHeader'
import StatusPill from '../components/StatusPill'
import { BACKTEST, RULES, RULE_JSON } from '../data/sample'
import { useAuth } from '../auth/AuthContext'

const AUTHOR = 'risk1'

export default function RuleEditor() {
  const { user, can } = useAuth()
  const [published, setPublished] = useState(false)
  const isAuthor = user?.name === AUTHOR
  const canPublish = can('rule:publish') && !isAuthor
  return (
    <>
      <PageHeader
        title="Rule editor"
        subtitle="Draft version 15 of the invoice scoring rules."
        actions={<Button disabled={!canPublish || published} onClick={() => setPublished(true)}>Publish rule set</Button>}
      />
      <Notice kind="warning">
        The author of a rule set cannot publish it. This draft was written by {AUTHOR}.
        {isAuthor && ' Ask another Risk Admin to publish.'}
      </Notice>
      {published && <Notice kind="success">Rule set v15 published.</Notice>}
      <DataTable
        title="Rules"
        columns={[
          { key: 'name', header: 'Rule', render: (r) => <b>{r.name}</b> },
          { key: 'type', header: 'Type' },
          { key: 'points', header: 'Points' },
          { key: 'status', header: 'Status', render: (r) => <StatusPill>{String(r.status)}</StatusPill> },
        ]}
        rows={RULES}
      />
      <Grid>
        <Card title="Rule definition">
          <pre className="m-0 overflow-x-auto rounded-[12px] bg-[#1C1250] p-4 text-[13px] leading-relaxed text-[#E7E2FF]">
            <code>{RULE_JSON}</code>
          </pre>
        </Card>
        <DataTable
          title="Back-test"
          columns={[
            { key: 'metric', header: 'Metric' },
            { key: 'current', header: 'Live v14', align: 'right' },
            { key: 'draft', header: 'Draft v15', align: 'right' },
          ]}
          rows={BACKTEST}
        />
      </Grid>
    </>
  )
}
