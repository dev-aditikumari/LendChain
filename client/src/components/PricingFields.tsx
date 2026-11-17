import type { PricingConfig } from '../api/types'
import { toPaise } from '../lib/format'
import Button from './Button'
import Card from './Card'
import { Field } from './Field'

const num = (s: string) => (s.trim() === '' || Number.isNaN(Number(s)) ? NaN : Number(s))

// edits the pricing block of a draft; values are kept as numbers, a blank box becomes NaN and the server refuses it
export default function PricingFields({ value, onChange }: { value: PricingConfig; onChange: (p: PricingConfig) => void }) {
  const set = <K extends keyof PricingConfig>(k: K, v: PricingConfig[K]) => onChange({ ...value, [k]: v })
  return (
    <Card title="Pricing">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Base rate (% a year)" type="number" step="any" value={Number.isNaN(value.baseRate) ? '' : value.baseRate} onChange={(e) => set('baseRate', num(e.target.value))} />
        <Field label="Minimum fee (₹)" type="number" step="any" value={Number.isNaN(value.minFee) ? '' : value.minFee / 100} onChange={(e) => set('minFee', toPaise(num(e.target.value)))} />
        <Field label="Fee (% of amount financed)" type="number" step="any" value={Number.isNaN(value.feePercent) ? '' : value.feePercent} onChange={(e) => set('feePercent', num(e.target.value))} />
        <Field label="Default advance (%)" type="number" step="any" value={Number.isNaN(value.defaultAdvancePercent) ? '' : value.defaultAdvancePercent} onChange={(e) => set('defaultAdvancePercent', num(e.target.value))} />
        <Field label="Approve at score" type="number" value={Number.isNaN(value.approveScore) ? '' : value.approveScore} onChange={(e) => set('approveScore', num(e.target.value))} hint="Scores at or above this are approved" />
        <Field label="Refer at score" type="number" value={Number.isNaN(value.referScore) ? '' : value.referScore} onChange={(e) => set('referScore', num(e.target.value))} hint="Between refer and approve goes to a person" />
      </div>

      <h3 className="mb-2 mt-5 text-[15px]">Score bands</h3>
      <div className="grid gap-3">
        {value.scoreBands.map((b, i) => (
          <div key={i} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Field label="Score at least" type="number" value={Number.isNaN(b.min) ? '' : b.min} onChange={(e) => set('scoreBands', value.scoreBands.map((x, j) => (j === i ? { ...x, min: num(e.target.value) } : x)))} />
            <Field label="Rate premium (%)" type="number" step="any" value={Number.isNaN(b.premium) ? '' : b.premium} onChange={(e) => set('scoreBands', value.scoreBands.map((x, j) => (j === i ? { ...x, premium: num(e.target.value) } : x)))} />
            <Button variant="row" disabled={value.scoreBands.length === 1} onClick={() => set('scoreBands', value.scoreBands.filter((_, j) => j !== i))} aria-label={`Remove score band ${i + 1}`}>Remove</Button>
          </div>
        ))}
        <div><Button variant="row" onClick={() => set('scoreBands', [...value.scoreBands, { min: 0, premium: 0 }])}>Add score band</Button></div>
      </div>

      <h3 className="mb-2 mt-5 text-[15px]">Tenure slabs</h3>
      <div className="grid gap-3">
        {value.tenureSlabs.map((s, i) => (
          <div key={i} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Field label="Up to (days)" type="number" value={Number.isNaN(s.upToDays) ? '' : s.upToDays} onChange={(e) => set('tenureSlabs', value.tenureSlabs.map((x, j) => (j === i ? { ...x, upToDays: num(e.target.value) } : x)))} />
            <Field label="Rate added (%)" type="number" step="any" value={Number.isNaN(s.add) ? '' : s.add} onChange={(e) => set('tenureSlabs', value.tenureSlabs.map((x, j) => (j === i ? { ...x, add: num(e.target.value) } : x)))} />
            <Button variant="row" disabled={value.tenureSlabs.length === 1} onClick={() => set('tenureSlabs', value.tenureSlabs.filter((_, j) => j !== i))} aria-label={`Remove tenure slab ${i + 1}`}>Remove</Button>
          </div>
        ))}
        <div><Button variant="row" onClick={() => set('tenureSlabs', [...value.tenureSlabs, { upToDays: 120, add: 0 }])}>Add tenure slab</Button></div>
      </div>
    </Card>
  )
}
