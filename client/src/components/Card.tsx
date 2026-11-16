import type { ReactNode } from 'react'

interface CardProps {
  title?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  flush?: boolean
}

export default function Card({ title, action, children, className = '', flush }: CardProps) {
  return (
    <section
      className={`rounded-card border border-line bg-white/80 shadow-[0_8px_24px_rgba(88,60,200,.08)] ${flush ? '' : 'p-[18px]'} ${className}`}
    >
      {(title || action) && (
        <div className={`flex items-center justify-between gap-3 ${flush ? 'px-[18px] pt-[18px]' : ''} mb-3`}>
          {title && <h2 className="text-[17px]">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
