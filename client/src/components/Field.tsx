import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'

const BOX =
  'min-h-11 w-full rounded-[10px] border border-input-border bg-white/90 px-3 text-ink placeholder:text-muted/70'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
}

export function Field({ label, hint, className = '', ...rest }: FieldProps) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold">{label}</label>
      <input id={id} className={BOX} {...rest} />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  children: ReactNode
}

export function SelectField({ label, children, className = '', ...rest }: SelectProps) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold">{label}</label>
      <select id={id} className={BOX} {...rest}>{children}</select>
    </div>
  )
}

export function TextArea({ label, className = '', ...rest }: { label: string; className?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold">{label}</label>
      <textarea id={id} rows={3} className={`${BOX} py-2`} {...rest} />
    </div>
  )
}
