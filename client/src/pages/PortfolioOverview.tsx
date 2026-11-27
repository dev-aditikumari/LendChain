import { http } from '../api/http'
import type { Overview } from '../api/types'
import BarChart from '../components/BarChart'
import Card from '../components/Card'
import DataTable from '../components/DataTable'
import DonutChart from '../components/DonutChart'
import KpiRow, { Grid } from '../components/KpiRow'
import PageHeader from '../components/PageHeader'
import { Async, useRequest } from '../components/RequestState'
import { inrShort, money } from '../lib/format'

const load = () => http<Overview>('/portfolio/overview')
const lakh = (paise: number) => Math.round((paise / 1e7) * 10) / 10

export default function PortfolioOverview() {
  const req = useRequest(load)
  return (
    <>
      <PageHeader title="Portfolio overview" subtitle="How the book looks across all programs." />
      <Async req={req}>
        {(o) => {
          const top = Math.max(1, ...o.funnel.map((f) => f.value))
          const anyPaid = o.months.some((m) => m.paise > 0)
          return (
            <>
              <KpiRow
                items={[
                  { label: 'Outstanding', value: inrShort(o.outstanding / 100), sub: `${o.outstandingInvoices} invoice${o.outstandingInvoices === 1 ? '' : 's'} · ${o.suppliers} supplier${o.suppliers === 1 ? '' : 's'}`, trend: 'Paid out and not yet repaid' },
                  { label: 'Disbursed this month', value: inrShort(o.disbursedThisMonth / 100), sub: `${o.disbursedThisMonthCount} invoice${o.disbursedThisMonthCount === 1 ? '' : 's'}`, trend: 'Advances released since the 1st' },
                  { label: 'Overdue rate', value: `${o.overdueRate}%`, pill: o.overdueRate > 1 ? { text: 'Above the 1% target', kind: 'danger' } : { text: 'Within target', kind: 'success' }, trend: 'Overdue share of outstanding' },
                  { label: 'Average yield', value: `${o.averageYield}%`, sub: 'Annualised', trend: 'Weighted by amount paid out' },
                ]}
              />
              <Grid>
                <Card title="Monthly disbursement (₹ lakh)">
                  {anyPaid ? (
                    <BarChart data={o.months.map((m) => ({ label: m.label, value: lakh(m.paise) }))} ariaLabel={`Disbursement by month in lakh rupees: ${o.months.map((m) => `${m.label} ${lakh(m.paise)}`).join(', ')}`} />
                  ) : (
                    <p className="m-0 text-muted">Nothing has been paid out in the last six months.</p>
                  )}
                </Card>
                <Card title="Invoices by status">
                  {o.statusMix.length ? <DonutChart data={o.statusMix} ariaLabel="Share of invoices by status" /> : <p className="m-0 text-muted">There are no invoices yet.</p>}
                </Card>
              </Grid>
              <Grid>
                <DataTable
                  title="Largest programs"
                  columns={[
                    { key: 'buyer', header: 'Buyer', render: (r) => <b>{r.buyer}</b> },
                    { key: 'supplier', header: 'Supplier' },
                    { key: 'sanctioned', header: 'Limit', align: 'right', render: (r) => money(r.sanctioned) },
                    { key: 'used', header: 'Used', align: 'right', render: (r) => money(r.used) },
                  ]}
                  rows={o.topPrograms}
                  rowKey={(r) => r.id}
                  empty="No program has been set up yet."
                />
                <Card title="Funnel">
                  <ul className="m-0 grid list-none gap-3 p-0">
                    {o.funnel.map((f) => (
                      <li key={f.label}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span>{f.label}</span>
                          <span className="font-bold">{f.value.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-track" aria-hidden="true">
                          <div className="h-full rounded-full bg-violet" style={{ width: `${(f.value / top) * 100}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              </Grid>
            </>
          )
        }}
      </Async>
    </>
  )
}
