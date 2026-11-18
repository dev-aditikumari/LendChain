import { useEffect, useState } from 'react'
import { http } from '../api/http'
import type { AccrualList, AccrualResult } from '../api/types'
import Button from '../components/Button'
import DataTable from '../components/DataTable'
import { Field } from '../components/Field'
import FormCard from '../components/FormCard'
import KpiRow from '../components/KpiRow'
import Notice from '../components/Notice'
import PageHeader from '../components/PageHeader'
import { Async, ErrorMessage, useMutation, useRequest } from '../components/RequestState'
import { useAuth } from '../auth/AuthContext'
import { dateTime, money } from '../lib/format'

const load = () => http<AccrualList>('/ledger/accruals')

function View({ data, reload }: { data: AccrualList; reload: () => void }) {
  const { can } = useAuth()
  const [date, setDate] = useState(data.suggestedDate)
  const [result, setResult] = useState<AccrualResult | null>(null)
  const m = useMutation()
  useEffect(() => setDate(data.suggestedDate), [data.suggestedDate])

  const run = async () => {
    setResult(null)
    const r = await m.run(() => http<AccrualResult>('/ledger/accruals/run', { body: { date } }))
    if (r) { setResult(r); reload() }
  }

  return (
    <>
      <KpiRow
        items={[
          { label: 'Unearned interest', value: money(data.unearned), sub: 'Collected up front, not yet earned', trend: 'Moves to income day by day' },
          { label: 'Payouts still accruing', value: String(data.openPayouts), sub: 'With interest left to earn', trend: 'Until due date or repayment' },
          { label: 'Last run', value: data.runs[0]?.date ?? 'None yet', sub: data.runs[0] ? `${data.runs[0].count} payouts, ${money(data.runs[0].amount)}` : 'No day has been run', trend: 'The schedule runs after midnight' },
        ]}
      />
      {can('journal:post') ? (
        <FormCard title="Run accruals for a day" onSubmit={run} buttons={<Button type="submit" disabled={m.busy || !date}>Run accruals</Button>}>
          <p className="m-0 text-sm text-muted">
            Books one day of the interest taken at payout as income. A day can only be run once: running it again posts nothing. Today cannot be run until it has finished.
          </p>
          {m.error != null && <ErrorMessage error={m.error} />}
          {result && (
            <Notice kind={result.alreadyRun ? 'info' : 'success'}>
              {result.alreadyRun
                ? `${result.date} was already run (${result.count} payouts, ${money(result.amount)}). Nothing was posted again.`
                : `${result.date}: ${result.count} payouts accrued, ${money(result.amount)} moved to interest income.`}
            </Notice>
          )}
          <Field label="Day" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="max-w-xs" />
        </FormCard>
      ) : (
        <Notice>Only accountants can run accruals. This page shows what has been run.</Notice>
      )}
      <DataTable
        title="Accrual runs"
        columns={[
          { key: 'date', header: 'Day', render: (r) => <b>{r.date}</b> },
          { key: 'count', header: 'Payouts', align: 'right' },
          { key: 'amount', header: 'Interest earned', align: 'right', render: (r) => money(r.amount) },
          { key: 'runByName', header: 'Run by', render: (r) => r.runByName ?? '-' },
          { key: 'createdAt', header: 'Run at', render: (r) => dateTime(r.createdAt) },
        ]}
        rows={data.runs}
        rowKey={(r) => r._id}
        empty="No accrual has been run yet."
      />
    </>
  )
}

export default function Accruals() {
  const req = useRequest(load)
  return (
    <>
      <PageHeader title="Accruals" subtitle="Interest taken at payout is earned evenly until the due date." />
      <Async req={req}>{(data) => <View data={data} reload={req.reload} />}</Async>
    </>
  )
}
