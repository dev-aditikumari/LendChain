const inrFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
const moneyFmt = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

export function inr(n: number): string {
  return (n < 0 ? '-₹' : '₹') + inrFmt.format(Math.abs(n))
}

export function inrShort(n: number): string {
  const a = Math.abs(n)
  if (a >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`
  if (a >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`
  return inr(n)
}

// the API keeps money as whole paise
export function money(paise: number | undefined | null): string {
  const p = paise ?? 0
  return (p < 0 ? '-₹' : '₹') + moneyFmt.format(Math.abs(p) / 100)
}

export const toPaise = (rupees: number) => Math.round(rupees * 100)

export function shortDate(iso: string | undefined | null): string {
  return iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
