import type { Level } from '../lib/permissions'

const MARK: Record<Level, { ch: string; cls: string; text: string }> = {
  full: { ch: '●', cls: 'text-violet', text: 'Allowed' },
  view: { ch: '○', cls: 'text-[#7A4B00]', text: 'View only' },
  none: { ch: '–', cls: 'text-[#8A8FA8]', text: 'Not allowed' },
}

export default function PermissionCell({ level }: { level: Level }) {
  const m = MARK[level]
  return (
    <span className={`text-lg font-bold ${m.cls}`}>
      <span aria-hidden="true">{m.ch}</span>
      <span className="sr-only">{m.text}</span>
    </span>
  )
}
