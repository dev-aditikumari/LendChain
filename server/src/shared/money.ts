// all amounts are integer paise
export const toPaise = (rupees: number): number => Math.round(rupees * 100);
export const toRupees = (paise: number): number => paise / 100;

export function percentOf(amount: number, percent: number): number {
  return Math.round((amount * percent) / 100);
}

export function formatINR(paise: number): string {
  return "₹" + (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// simple interest for a number of days on a yearly rate (percent)
export function interestFor(principal: number, annualRatePercent: number, days: number): number {
  return Math.round((principal * annualRatePercent * days) / (100 * 365));
}
