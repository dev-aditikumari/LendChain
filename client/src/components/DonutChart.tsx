export interface Slice { label: string; value: number; color: string }

export default function DonutChart({ data, ariaLabel }: { data: Slice[]; ariaLabel: string }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const r = 54, c = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 140 140" role="img" aria-label={ariaLabel} className="size-[150px] shrink-0">
        <title>{ariaLabel}</title>
        <g transform="rotate(-90 70 70)">
          {data.map((d) => {
            const len = (d.value / total) * c
            const el = (
              <circle key={d.label} cx="70" cy="70" r={r} fill="none" stroke={d.color} strokeWidth="22"
                strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} />
            )
            offset += len
            return el
          })}
        </g>
      </svg>
      <ul className="m-0 grid list-none gap-2 p-0">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2">
            <span aria-hidden="true" className="size-3 rounded-[4px]" style={{ background: d.color }} />
            <span>{d.label}</span>
            <span className="font-bold">{Math.round((d.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
