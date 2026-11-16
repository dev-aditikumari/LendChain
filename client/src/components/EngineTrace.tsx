import type { Evaluation } from '../api/types'
import { money } from '../lib/format'
import DataTable from './DataTable'
import KeyValueCard from './KeyValueCard'
import StatusPill from './StatusPill'

export default function EngineTrace({ evaluation }: { evaluation: Evaluation }) {
  const r = evaluation.result
  return (
    <>
      <KeyValueCard
        title={`Engine result (rule set v${evaluation.ruleSetVersion})`}
        rows={[
          ['Decision', <StatusPill key="d" kind={r.decision === 'REJECT' ? 'danger' : r.decision === 'REFER' ? 'warning' : 'success'}>{r.decision}</StatusPill>],
          ['Score', String(r.score)],
          ['Discount rate', `${r.rate}% a year`],
          ['Advance', `${r.advancePercent}%`],
          ['Fee', money(r.fee)],
          ...(r.reasons.length ? [['Reasons', r.reasons.join(', ')] as [string, string]] : []),
        ]}
      />
      <DataTable
        title="Engine trace"
        columns={[
          { key: 'ruleId', header: 'Rule' },
          { key: 'type', header: 'Type' },
          { key: 'inputs', header: 'Inputs', render: (t) => Object.entries(t.inputs).map(([k, v]) => `${k}=${String(v)}`).join(', ') },
          { key: 'fired', header: 'Result', render: (t) => <StatusPill kind={t.fired ? 'warning' : 'success'}>{t.fired ? 'Fired' : 'Pass'}</StatusPill> },
        ]}
        rows={r.trace}
        rowKey={(t) => t.ruleId}
      />
    </>
  )
}
