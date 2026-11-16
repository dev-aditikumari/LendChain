import Card from '../components/Card'
import BarChart from '../components/BarChart'
import DataTable from '../components/DataTable'
import DonutChart from '../components/DonutChart'
import KpiRow, { Grid } from '../components/KpiRow'
import PageHeader from '../components/PageHeader'
import { DISBURSEMENT_MONTHS, FUNNEL, STATUS_MIX, TOP_PROGRAMS } from '../data/sample'
import { inrShort } from '../lib/format'

export default function PortfolioOverview() {
  const top = FUNNEL[0].value
  return (
    <>
      <PageHeader sample title="Portfolio overview" subtitle="How the book looks across all programs." />
      <KpiRow
        items={[
          { label: 'Outstanding', value: '₹21.8 Cr', sub: 'Across 91 suppliers', trend: 'Up 6% on October' },
          { label: 'Disbursed this month', value: '₹8.4 Cr', sub: '312 invoices', trend: 'Best month so far' },
          { label: 'Overdue rate', value: '0.4%', pill: { text: 'Verified', kind: 'success' }, trend: 'Below the 1% target' },
          { label: 'Average yield', value: '11.6%', sub: 'Annualised', trend: 'Flat on last month' },
        ]}
      />
      <Grid>
        <Card title="Monthly disbursement (₹ Cr)">
          <BarChart data={DISBURSEMENT_MONTHS} ariaLabel="Disbursement by month in crore rupees, rising from 4.2 in June to 8.4 in November" />
        </Card>
        <Card title="Invoices by status">
          <DonutChart data={STATUS_MIX} ariaLabel="Share of invoices by status" />
        </Card>
      </Grid>
      <Grid>
        <DataTable
          title="Top programs"
          columns={[
            { key: 'program', header: 'Program', render: (r) => <b>{r.program}</b> },
            { key: 'suppliers', header: 'Suppliers', align: 'right' },
            { key: 'limit', header: 'Limit', align: 'right', render: (r) => inrShort(Number(r.limit)) },
            { key: 'used', header: 'Used', align: 'right', render: (r) => inrShort(Number(r.used)) },
          ]}
          rows={TOP_PROGRAMS}
        />
        <Card title="Funnel">
          <ul className="m-0 grid list-none gap-3 p-0">
            {FUNNEL.map((f) => (
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
}
