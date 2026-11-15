export type InvoiceStatus =
  | "DRAFT" | "SUBMITTED" | "BUYER_CONFIRMED" | "DISPUTED" | "FINANCING_REQUESTED"
  | "ENGINE_EVALUATED" | "APPROVED" | "REJECTED" | "DISBURSED" | "REPAID"
  | "OVERDUE" | "WRITTEN_OFF" | "CANCELLED" | "CLOSED";

const transitions: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["BUYER_CONFIRMED", "DISPUTED", "CANCELLED"],
  BUYER_CONFIRMED: ["FINANCING_REQUESTED"],
  DISPUTED: ["SUBMITTED", "CANCELLED"],
  FINANCING_REQUESTED: ["ENGINE_EVALUATED"],
  ENGINE_EVALUATED: ["APPROVED", "REJECTED"],
  APPROVED: ["DISBURSED"],
  REJECTED: [],
  DISBURSED: ["REPAID", "OVERDUE"],
  OVERDUE: ["REPAID", "WRITTEN_OFF"],
  REPAID: ["CLOSED"],
  WRITTEN_OFF: [],
  CANCELLED: [],
  CLOSED: [],
};

export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return transitions[from].includes(to);
}

export function assertTransition(from: InvoiceStatus, to: InvoiceStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal invoice transition ${from} -> ${to}`);
  }
}
