import { useState } from 'react'
import { http } from '../api/http'
import type { Program } from '../api/types'
import Card from '../components/Card'
import KeyValueCard from '../components/KeyValueCard'
import { Grid } from '../components/KpiRow'
import LimitBar from '../components/LimitBar'
import PageHeader from '../components/PageHeader'
import { Async, useRequest } from '../components/RequestState'
import { money } from '../lib/format'

const load = () => http<Program[]>('/programs')

function View({ programs }: { programs: Program[] }) {
  const [selected, setSelected] = useState(0)
  if (programs.length === 0) return <Card title="No programs"><p className="m-0 text-muted">No program has been set up yet.</p></Card>
  const p = programs[Math.min(selected, programs.length - 1)]
  return (
    <Grid>
      <Card title="Utilisation">
        <ul className="m-0 grid list-none gap-4 p-0">
          {programs.map((r, i) => (
            <li key={r._id}>
              <button
                onClick={() => setSelected(i)}
                aria-pressed={r._id === p._id}
                className={`block min-h-11 w-full cursor-pointer rounded-[12px] border bg-transparent p-3 text-left ${r._id === p._id ? 'border-violet bg-violet-tint/50' : 'border-transparent hover:bg-violet-tint/30'}`}
              >
                <LimitBar label={`${r.supplierName} / ${r.buyerName}`} used={r.outstanding} limit={r.sanctioned} valueText={`${money(r.outstanding)} of ${money(r.sanctioned)}`} />
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <KeyValueCard
        title="Program details"
        rows={[
          ['Supplier', p.supplierName ?? '-'],
          ['Buyer', p.buyerName ?? '-'],
          ['Sanctioned limit', money(p.sanctioned)],
          ['Outstanding', money(p.outstanding)],
          ['Headroom', money(p.sanctioned - p.outstanding)],
          ['Max tenure', `${p.maxTenureDays} days`],
          ['Base rate', `${p.baseRate}% a year`],
        ]}
      />
    </Grid>
  )
}

export default function Programs() {
  const req = useRequest(load)
  return (
    <>
      <PageHeader title="Programs and limits" subtitle="Limit utilisation per supplier and buyer." />
      <Async req={req}>{(programs) => <View programs={programs} />}</Async>
    </>
  )
}
