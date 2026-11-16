import type { ReactNode } from 'react'
import Card from './Card'

export interface Column<T> {
  key: string
  header: string
  align?: 'left' | 'right'
  render?: (row: T) => ReactNode
}

interface Props<T> {
  title: string
  columns: Column<T>[]
  rows: T[]
  action?: ReactNode
  rowKey?: (row: T, i: number) => string
  empty?: string
}

export default function DataTable<T extends object>({ title, columns, rows, action, rowKey, empty }: Props<T>) {
  return (
    <Card title={title} action={action} flush className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-[15px]">
          <thead>
            <tr className="bg-th-bg">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`px-[18px] py-2.5 text-[13px] font-bold text-muted ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={rowKey ? rowKey(row, i) : i} className="border-t border-row-line">
                {columns.map((c) => (
                  <td key={c.key} className={`px-[18px] py-2.5 align-middle ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}>
                    {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={columns.length} className="px-[18px] py-6 text-center text-muted">{empty ?? 'Nothing here yet.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
