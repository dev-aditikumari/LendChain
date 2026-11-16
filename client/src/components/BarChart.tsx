export interface Bar { label: string; value: number }

export default function BarChart({ data, unit = '' , ariaLabel }: { data: Bar[]; unit?: string; ariaLabel: string }) {
  const max = Math.max(...data.map((d) => d.value))
  const W = 480, H = 220, pad = { t: 24, b: 28, l: 8, r: 8 }
  const slot = (W - pad.l - pad.r) / data.length
  const bw = Math.min(44, slot * 0.6)
  const plotH = H - pad.t - pad.b
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="h-auto w-full">
      <title>{ariaLabel}</title>
      {data.map((d, i) => {
        const h = (d.value / max) * plotH
        const x = pad.l + slot * i + (slot - bw) / 2
        const y = pad.t + plotH - h
        const latest = i === data.length - 1
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={bw} height={h} rx={8} fill={latest ? '#6D4AFF' : '#CDBFFF'} />
            <text x={x + bw / 2} y={y - 6} textAnchor="middle" fontSize="13" fontWeight="700" fill="#1B1340">{d.value}{unit}</text>
            <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="13" fill="#4A4570">{d.label}</text>
          </g>
        )
      })}
    </svg>
  )
}
