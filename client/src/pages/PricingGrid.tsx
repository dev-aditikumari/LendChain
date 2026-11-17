import { useNavigate } from 'react-router-dom'
import { http } from '../api/http'
import type { RuleSet } from '../api/types'
import Button from '../components/Button'
import Card from '../components/Card'
import KeyValueCard from '../components/KeyValueCard'
import { Grid } from '../components/KpiRow'
import PageHeader from '../components/PageHeader'
import { Async, useRequest } from '../components/RequestState'
import { money } from '../lib/format'

const load = () => http<RuleSet[]>('/rule-sets')

const round = (n: number) => Math.round(n * 100) / 100

function View({ rs }: { rs: RuleSet }) {
  const p = rs.pricing
  const slabs = [...p.tenureSlabs].sort((a, b) => a.upToDays - b.upToDays)
  const bands = [...p.scoreBands].sort((a, b) => b.min - a.min)
  const rows = [
    ...bands.map((b, i) => ({ label: i === 0 ? `Score ${b.min} and above` : `Score ${b.min} to ${bands[i - 1].min - 1}`, premium: b.premium })),
    { label: `Score below ${bands[bands.length - 1].min}`, premium: 0 },
  ]
  return (
    <Grid>
      <Card title="Rate (% a year)" flush className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-th-bg">
                <th scope="col" className="px-[18px] py-2.5 text-left text-[13px] font-bold text-muted">Score band</th>
                {slabs.map((s) => (
                  <th key={s.upToDays} scope="col" className="px-[18px] py-2.5 text-right text-[13px] font-bold text-muted">Up to {s.upToDays} days</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-row-line">
                  <th scope="row" className="px-[18px] py-2.5 text-left font-semibold">{r.label}</th>
                  {slabs.map((s) => (
                    <td key={s.upToDays} className="px-[18px] py-2.5 text-right tabular-nums">{round(p.baseRate + r.premium + s.add).toFixed(2)}%</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="m-0 px-[18px] py-3 text-sm text-muted">Base rate {p.baseRate}% plus the score premium plus the tenure add-on. Pricing rules can move a rate further.</p>
      </Card>
      <KeyValueCard
        title="Fees and decisions"
        rows={[
          ['Fee', `${p.feePercent}% of the amount financed`],
          ['Minimum fee', money(p.minFee)],
          ['Default advance', `${p.defaultAdvancePercent}%`],
          ['Approved at score', `${p.approveScore} and above`],
          ['Referred to a person', `${p.referScore} to ${p.approveScore - 1}`],
          ['Rejected', `below ${p.referScore}`],
        ]}
      />
    </Grid>
  )
}

export default function PricingGrid() {
  const nav = useNavigate()
  const req = useRequest(load)
  return (
    <>
      <PageHeader
        title="Pricing grid"
        subtitle="Annual discount rate by score band and tenure, from the live rule set."
        actions={<Button variant="secondary" onClick={() => nav('/rules')}>Rule sets</Button>}
      />
      <Async req={req}>
        {(sets) => {
          const live = sets.find((s) => s.status === 'PUBLISHED')
          return live
            ? <><p className="m-0 mb-3 text-muted">Showing version {live.version}.</p><View rs={live} /></>
            : <Card title="Nothing live yet"><p className="m-0 text-muted">No rule set has been published.</p></Card>
        }}
      </Async>
    </>
  )
}
