import type { ReactNode } from 'react'
import Card from './Card'

export default function KeyValueCard({ title, rows, action }: { title: string; rows: [string, ReactNode][]; action?: ReactNode }) {
  return (
    <Card title={title} action={action}>
      <dl className="m-0">
        {rows.map(([k, v], i) => (
          <div key={k} className={`flex items-center justify-between gap-4 py-2.5 ${i ? 'border-t border-row-line' : ''}`}>
            <dt className="text-muted">{k}</dt>
            <dd className="m-0 text-right font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}
