export type Account =
  | "LENDER_POOL" | "SUPPLIER_RECEIVABLE" | "BUYER_RECEIVABLE"
  | "FEE_INCOME" | "INTEREST_INCOME" | "PENAL_INCOME" | "HOLDBACK" | "BANK";

export interface Line {
  account: Account;
  debit: number;
  credit: number;
}

export function assertBalanced(lines: Line[]): void {
  let d = 0;
  let c = 0;
  for (const l of lines) {
    if (!Number.isInteger(l.debit) || !Number.isInteger(l.credit) || l.debit < 0 || l.credit < 0) {
      throw new Error("Ledger amounts must be non-negative integers");
    }
    d += l.debit;
    c += l.credit;
  }
  if (d !== c) throw new Error(`Unbalanced entry: debit ${d} credit ${c}`);
}

// money leaves the pool: buyer owes the full invoice, supplier gets net, fees booked as income
export function disbursementLines(p: { advance: number; fee: number; upfrontInterest: number }): Line[] {
  const net = p.advance - p.fee - p.upfrontInterest;
  const lines: Line[] = [
    { account: "BUYER_RECEIVABLE", debit: p.advance, credit: 0 },
    { account: "LENDER_POOL", debit: 0, credit: net },
  ];
  if (p.fee) lines.push({ account: "FEE_INCOME", debit: 0, credit: p.fee });
  if (p.upfrontInterest) lines.push({ account: "INTEREST_INCOME", debit: 0, credit: p.upfrontInterest });
  assertBalanced(lines);
  return lines;
}

export interface Dues {
  penal: number;
  fees: number;
  interest: number;
  principal: number;
}

// allocation order: penal, fees, interest, principal
export function allocateRepayment(amount: number, dues: Dues): { allocated: Dues; excess: number } {
  let left = amount;
  const take = (due: number) => {
    const t = Math.min(left, due);
    left -= t;
    return t;
  };
  const allocated = {
    penal: take(dues.penal),
    fees: take(dues.fees),
    interest: take(dues.interest),
    principal: take(dues.principal),
  };
  return { allocated, excess: left };
}

export function repaymentLines(a: Dues): Line[] {
  const total = a.penal + a.fees + a.interest + a.principal;
  const lines: Line[] = [{ account: "LENDER_POOL", debit: total, credit: 0 }];
  if (a.principal) lines.push({ account: "BUYER_RECEIVABLE", debit: 0, credit: a.principal });
  if (a.interest) lines.push({ account: "INTEREST_INCOME", debit: 0, credit: a.interest });
  if (a.fees) lines.push({ account: "FEE_INCOME", debit: 0, credit: a.fees });
  if (a.penal) lines.push({ account: "PENAL_INCOME", debit: 0, credit: a.penal });
  assertBalanced(lines);
  return lines;
}
