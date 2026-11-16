import Card from '../components/Card'
import DataTable from '../components/DataTable'
import { Grid } from '../components/KpiRow'
import PageHeader from '../components/PageHeader'
import { FEES, PRICING_BANDS, PRICING_GRID, PRICING_TENURES } from '../data/sample'

export default function PricingGrid() {
  return (
    <>
      <PageHeader title="Pricing grid" subtitle="Annual discount rate by score band and tenure." />
      <Grid>
        <Card title="Rate (% a year)" flush className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-th-bg">
                  <th scope="col" className="px-[18px] py-2.5 text-left text-[13px] font-bold text-muted">Score band</th>
                  {PRICING_TENURES.map((t) => (
                    <th key={t} scope="col" className="px-[18px] py-2.5 text-right text-[13px] font-bold text-muted">{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PRICING_BANDS.map((b, i) => (
                  <tr key={b} className="border-t border-row-line">
                    <th scope="row" className="px-[18px] py-2.5 text-left font-semibold">{b}</th>
                    {PRICING_GRID[i].map((v, j) => (
                      <td key={j} className="px-[18px] py-2.5 text-right tabular-nums">{v.toFixed(2)}%</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <DataTable
          title="Fees"
          columns={[{ key: 'fee', header: 'Fee' }, { key: 'value', header: 'Value' }]}
          rows={FEES}
        />
      </Grid>
    </>
  )
}
