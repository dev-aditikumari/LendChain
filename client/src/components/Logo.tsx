import { useId } from 'react'

export function LogoMark({ size = 38 }: { size?: number }) {
  const id = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8B6BFF" />
          <stop offset="1" stopColor="#3447B8" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#${id})`} />
      <g transform="rotate(-35 20 20)" fill="none" strokeWidth="3.2">
        <rect x="5" y="14" width="18" height="12" rx="6" stroke="#fff" />
        <rect x="17" y="14" width="18" height="12" rx="6" stroke="#FFC94D" />
      </g>
    </svg>
  )
}

export default function Logo({ size = 38 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="font-display text-[22px] font-extrabold">
        <span className="text-white">Lend</span><span className="text-sun">Chain</span>
      </span>
    </div>
  )
}
