import type { ReactNode } from 'react'

export type NoticeKind = 'info' | 'warning' | 'success' | 'danger'

const TINT: Record<NoticeKind, string> = {
  info: 'bg-violet-tint text-[#4B2FBF]',
  warning: 'bg-[#FEF0C7] text-[#7A4B00]',
  success: 'bg-[#DDF5E8] text-[#0F5132]',
  danger: 'bg-[#FDE2E2] text-[#8A1C1C]',
}

export default function Notice({ kind = 'info', children }: { kind?: NoticeKind; children: ReactNode }) {
  return (
    <div role="note" className={`flex items-start gap-3 rounded-[14px] px-4 py-3 ${TINT[kind]}`}>
      <span aria-hidden="true" className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-current">
        <span className="font-display text-[12px] font-extrabold leading-none text-white mix-blend-normal">i</span>
      </span>
      <div className="text-[15px]">{children}</div>
    </div>
  )
}
