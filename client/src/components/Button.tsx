import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'row' | 'danger'

const STYLE: Record<Variant, string> = {
  primary:
    'text-white font-bold text-[15px] bg-[linear-gradient(135deg,#6D4AFF,#4B3FD6)] shadow-[0_6px_14px_rgba(88,60,200,.28)] hover:brightness-110',
  secondary: 'bg-white text-violet font-bold text-[15px] border border-violet-soft hover:bg-violet-tint',
  row: 'bg-white text-violet font-bold text-sm border border-violet hover:bg-violet-tint',
  danger: 'bg-white text-danger font-bold text-[15px] border border-danger hover:bg-[#FDE2E2]',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

export default function Button({ variant = 'primary', className = '', type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      className={`min-h-11 rounded-[10px] px-4 cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed ${STYLE[variant]} ${className}`}
      {...rest}
    />
  )
}
