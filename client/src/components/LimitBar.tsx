export default function LimitBar({ label, used, limit, valueText }: { label: string; used: number; limit: number; valueText: string }) {
  const pct = Math.min(100, Math.round((used / limit) * 100))
  const hot = pct > 85
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold">{label}</span>
        <span className="text-muted">{valueText} <span className={hot ? 'font-bold text-warn' : ''}>({pct}%)</span></span>
      </div>
      <div
        role="progressbar"
        aria-label={`${label} utilisation`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-2.5 overflow-hidden rounded-full bg-track"
      >
        <div className={`h-full rounded-full ${hot ? 'bg-warn' : 'bg-violet'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
