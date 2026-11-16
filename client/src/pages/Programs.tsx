import { useState } from 'react'
import Card from '../components/Card'
import KeyValueCard from '../components/KeyValueCard'
import { Grid } from '../components/KpiRow'
import LimitBar from '../components/LimitBar'
import PageHeader from '../components/PageHeader'
import { TOP_PROGRAMS } from '../data/sample'
import { inrShort } from '../lib/format'

export default function Programs() {
  const [selected, setSelected] = useState(0)
  const p = TOP_PROGRAMS[selected]
  const limit = Number(p.limit), used = Number(p.used)
  return (
    <>
      <PageHeader title="Programs and limits" subtitle="Limit utilisation per buyer program." />
      <Grid>
        <Card title="Utilisation">
          <ul className="m-0 grid list-none gap-4 p-0">
            {TOP_PROGRAMS.map((r, i) => (
              <li key={String(r.program)}>
                <button
                  onClick={() => setSelected(i)}
                  aria-pressed={i === selected}
                  className={`block min-h-11 w-full cursor-pointer rounded-[12px] border bg-transparent p-3 text-left ${i === selected ? 'border-violet bg-violet-tint/50' : 'border-transparent hover:bg-violet-tint/30'}`}
                >
                  <LimitBar label={String(r.program)} used={Number(r.used)} limit={Number(r.limit)} valueText={`${inrShort(Number(r.used))} of ${inrShort(Number(r.limit))}`} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
        <KeyValueCard
          title={`${p.program} details`}
          rows={[
            ['Suppliers onboarded', String(p.suppliers)],
            ['Program limit', inrShort(limit)],
            ['Used', inrShort(used)],
            ['Headroom', inrShort(limit - used)],
            ['Max tenure', '90 days'],
            ['Concentration cap per supplier', '45%'],
          ]}
        />
      </Grid>
    </>
  )
}
