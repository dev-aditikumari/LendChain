import type { FormEvent, ReactNode } from 'react'
import Card from './Card'

interface Props {
  title: string
  children: ReactNode
  buttons: ReactNode
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void
}

export default function FormCard({ title, children, buttons, onSubmit }: Props) {
  return (
    <Card title={title}>
      <form
        onSubmit={(e) => { e.preventDefault(); onSubmit?.(e) }}
        className="grid gap-3"
      >
        {children}
        <div className="mt-1 flex flex-wrap gap-3">{buttons}</div>
      </form>
    </Card>
  )
}
