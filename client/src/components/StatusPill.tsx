export type PillKind = 'success' | 'warning' | 'info' | 'danger' | 'neutral'

const STYLE: Record<PillKind, string> = {
  success: 'bg-[#DDF5E8] text-[#0F5132]',
  warning: 'bg-[#FEF0C7] text-[#7A4B00]',
  info: 'bg-[#ECE6FF] text-[#4B2FBF]',
  danger: 'bg-[#FDE2E2] text-[#8A1C1C]',
  neutral: 'bg-[#EEF0F6] text-[#3A3560]',
}

const KIND_BY_TEXT: Record<string, PillKind> = {
  Verified: 'success', Disbursed: 'success', Matched: 'success', Balanced: 'success', Posted: 'success',
  Done: 'success', Pass: 'success', Active: 'success', Confirmed: 'success', Repaid: 'success',
  'Under review': 'warning', Pending: 'warning', 'Near limit': 'warning', Refer: 'warning',
  'Awaiting you': 'warning', Medium: 'warning', Draft: 'warning',
  'Buyer confirmed': 'info', Eligibility: 'info', Approved: 'info',
  Rejected: 'danger', Failed: 'danger', Disputed: 'danger', High: 'danger', Fail: 'danger', Overdue: 'danger', Unmatched: 'warning',
  'Not uploaded': 'neutral', Paused: 'neutral', Low: 'neutral', Unassigned: 'neutral',
}

export function kindFor(text: string): PillKind {
  return KIND_BY_TEXT[text] ?? 'neutral'
}

export default function StatusPill({ children, kind }: { children: string; kind?: PillKind }) {
  const k = kind ?? kindFor(children)
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-xs font-semibold whitespace-nowrap ${STYLE[k]}`}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  )
}
