import { useState } from 'react'
import { http } from '../api/http'
import type { TrialBalance as Trial } from '../api/types'
import Button from '../components/Button'
import DataTable from '../components/DataTable'
import { Field } from '../components/Field'
import KpiRow from '../components/KpiRow'
import Notice from '../components/Notice'
import PageHeader from '../components/PageHeader'
import { Async, useRequest } from '../components/RequestState'
import { accountLabel } from '../lib/accounts'
import { money } from '../lib/format'

export default function TrialBalance() {
  const [asOf, setAsOf] = useState('')
  const req = useRequest(() => http<Trial>(`/ledger/trial-balance${asOf ? `?asOf=${asOf}` : ''}`), asOf)
  return (
    <>
      <PageHeader title="Trial balance" subtitle="Debits and credits per account. The difference must be zero." />
      <div className="flex flex-wrap items-end gap-3">
        <Field label="As of" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} hint="Leave empty for today" className="w-52" />
        {asOf && <Button variant="secondary" onClick={() => setAsOf('')}>Clear date</Button>}
      </div>
      <Async req={req}>
        {(t) => (
          <>
            <KpiRow
              items={[
                { label: 'Total debits', value: money(t.debit), sub: t.asOf ? `Up to ${t.asOf}` : 'To date', trend: `${t.accounts.length} accounts` },
                { label: 'Total credits', value: money(t.credit), sub: t.asOf ? `Up to ${t.asOf}` : 'To date', trend: `${t.accounts.length} accounts` },
                { label: 'Difference', value: money(t.difference), pill: t.difference === 0 ? { text: 'Balanced', kind: 'success' } : { text: 'Out of balance', kind: 'danger' }, trend: 'Must be zero' },
                { label: 'Unbalanced transactions', value: String(t.unbalanced.length), sub: 'Debits not equal to credits', trend: 'Checked per transaction' },
              ]}
            />
            {t.unbalanced.length > 0 && (
              <Notice kind="danger">Some transactions do not balance: {t.unbalanced.map((u) => u.txId).join(', ')}.</Notice>
            )}
            <DataTable
              title="Accounts"
              columns={[
                { key: 'account', header: 'Account', render: (r) => <b>{accountLabel(r.account)}</b> },
                { key: 'debit', header: 'Debit', align: 'right', render: (r) => money(r.debit) },
                { key: 'credit', header: 'Credit', align: 'right', render: (r) => money(r.credit) },
                { key: 'balance', header: 'Balance', align: 'right', render: (r) => `${money(Math.abs(r.balance))} ${r.balance === 0 ? '' : r.balance > 0 ? 'Dr' : 'Cr'}` },
              ]}
              rows={t.accounts}
              rowKey={(r) => r.account}
              empty="Nothing has been posted yet."
            />
          </>
        )}
      </Async>
    </>
  )
}
