export default function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="m-0 flex list-none gap-1 overflow-x-auto p-0 pb-1">
      {steps.map((s, i) => {
        const done = i < current
        const now = i === current
        return (
          <li key={s} className="flex min-w-[88px] flex-1 flex-col items-center text-center" aria-current={now ? 'step' : undefined}>
            <div className="flex w-full items-center">
              <span className={`h-0.5 flex-1 ${i === 0 ? 'opacity-0' : done || now ? 'bg-violet' : 'bg-track'}`} />
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
                  done ? 'bg-violet text-white' : now ? 'bg-white text-violet border-2 border-violet shadow-[0_0_0_4px_rgba(109,74,255,.18)]' : 'bg-track text-muted'
                }`}
              >
                {done ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 7.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                ) : i + 1}
              </span>
              <span className={`h-0.5 flex-1 ${i === steps.length - 1 ? 'opacity-0' : done ? 'bg-violet' : 'bg-track'}`} />
            </div>
            <span className={`mt-1.5 text-xs ${now ? 'font-bold text-ink' : 'text-muted'}`}>
              {s}
              <span className="sr-only">{done ? ' (completed)' : now ? ' (current)' : ''}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
