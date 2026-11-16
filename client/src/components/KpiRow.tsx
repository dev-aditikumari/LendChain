import type { ReactNode } from 'react'
import StatusPill, { type PillKind } from './StatusPill'

export interface Kpi {
  label: string
  value: string
  sub?: string
  pill?: { text: string; kind: PillKind }
  trend?: string
}

export function KpiCard({ kpi, featured }: { kpi: Kpi; featured?: boolean }) {
  const base = featured
    ? 'text-white bg-[linear-gradient(135deg,#6D4AFF,#4B3FD6_62%,#3447B8)] shadow-[0_10px_24px_rgba(88,60,200,.28)]'
    : 'bg-white/80 border border-line shadow-[0_8px_24px_rgba(88,60,200,.08)]'
  return (
    <div className={`rounded-card p-[18px] ${base}`}>
      <p className={`m-0 text-sm font-semibold ${featured ? 'text-white/90' : 'text-muted'}`}>{kpi.label}</p>
      <p className="font-display mt-1 mb-0 text-[28px] font-extrabold leading-tight">{kpi.value}</p>
      <div className="mt-1 min-h-6 text-[13px]">
        {kpi.pill ? <StatusPill kind={kpi.pill.kind}>{kpi.pill.text}</StatusPill> : <span className={featured ? 'text-white/90' : 'text-muted'}>{kpi.sub}</span>}
      </div>
      {kpi.trend && <p className={`m-0 mt-1 text-xs ${featured ? 'text-white/85' : 'text-muted'}`}>{kpi.trend}</p>}
    </div>
  )
}

export default function KpiRow({ items }: { items: Kpi[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((k, i) => <KpiCard key={k.label} kpi={k} featured={i === 0} />)}
    </div>
  )
}

export function Grid({ cols = 2, children }: { cols?: 2 | 3; children: ReactNode }) {
  return <div className={`grid grid-cols-1 gap-4 ${cols === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>{children}</div>
}
