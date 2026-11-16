export default function Timeline({ items }: { items: { event: string; detail: string }[] }) {
  return (
    <ol className="m-0 list-none p-0">
      {items.map((it, i) => (
        <li key={it.event} className="relative flex gap-3 pb-4 last:pb-0">
          {i < items.length - 1 && <span aria-hidden="true" className="absolute left-[5px] top-4 bottom-0 w-px bg-line" />}
          <span aria-hidden="true" className="relative mt-1.5 size-[11px] shrink-0 rounded-full bg-violet" />
          <div>
            <p className="m-0 font-bold">{it.event}</p>
            <p className="m-0 text-[13px] text-muted">{it.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
