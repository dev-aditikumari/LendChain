const inrFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

export function inr(n: number): string {
  return (n < 0 ? '-₹' : '₹') + inrFmt.format(Math.abs(n))
}

export function inrShort(n: number): string {
  const a = Math.abs(n)
  if (a >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`
  if (a >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`
  return inr(n)
}
