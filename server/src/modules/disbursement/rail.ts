// The bank transfer. There is no real bank behind it: the mock accepts every transfer
// except to an account number ending in 0000 (a closed account), so failures can be shown and tested.
export type RailResult = { ok: true; reference: string } | { ok: false; reason: string };

export interface TransferRequest {
  disbursementId: string;
  amount: number;
  account?: string | null;
}

export const rail: { send: (t: TransferRequest) => Promise<RailResult> } = {
  async send(t) {
    if (t.account && /0000$/.test(t.account)) return { ok: false, reason: "Beneficiary account is closed" };
    return { ok: true, reference: "LCPAY" + t.disbursementId.slice(-8).toUpperCase() };
  },
};

export class RailFailure extends Error {
  constructor(public reason: string) {
    super(reason);
  }
}
