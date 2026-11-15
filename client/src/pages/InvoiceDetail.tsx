import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, date, rupees } from "../api";
import { useAuth } from "../auth";
import Trace from "./Trace";

export default function InvoiceDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [dues, setDues] = useState<any>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [text, setText] = useState("");
  const [amount, setAmount] = useState("");
  const [utr, setUtr] = useState("");
  const [idemKey] = useState(() => crypto.randomUUID());

  const load = useCallback(async () => {
    try {
      const r = await api(`/invoices/${id}`);
      setData(r);
      if (["DISBURSED", "OVERDUE"].includes(r.invoice.status)) setDues(await api(`/repayments/dues/${id}`));
      else setDues(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function run(fn: () => Promise<unknown>, done: string) {
    setError("");
    setMsg("");
    try {
      await fn();
      setMsg(done);
      setText("");
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (!data) return error ? <div className="err">{error}</div> : <p>Loading...</p>;
  const inv = data.invoice;
  const role = user!.role;
  const post = (path: string, body: unknown = {}, headers?: Record<string, string>) => api(path, { body, headers });

  return (
    <>
      <h2>Invoice {inv.number} <span className="tag">{inv.status}</span></h2>
      <div className="box row">
        <div>Amount<br /><b>{rupees(inv.amount)}</b></div>
        <div>Issued<br /><b>{date(inv.issueDate)}</b></div>
        <div>Due<br /><b>{date(inv.dueDate)}</b></div>
        {inv.financedAmount && <div>Financed<br /><b>{rupees(inv.financedAmount)}</b></div>}
      </div>

      {error && <div className="err">{error}</div>}
      {msg && <div className="ok">{msg}</div>}

      <div className="box">
        <h3 style={{ marginTop: 0 }}>Actions</h3>
        {role === "SUPPLIER" && inv.status === "DRAFT" && (
          <button onClick={() => run(() => post(`/invoices/${id}/submit`), "Invoice submitted")}>Submit to buyer</button>
        )}
        {role === "SUPPLIER" && inv.status === "BUYER_CONFIRMED" && (
          <button onClick={() => run(() => post(`/invoices/${id}/financing-requests`), "Financing requested")}>Request financing</button>
        )}
        {role === "BUYER" && inv.status === "SUBMITTED" && (
          <>
            <button onClick={() => run(() => post(`/invoices/${id}/confirm`), "Invoice confirmed")}>Confirm invoice</button>
            <p>
              <input placeholder="Dispute reason" value={text} onChange={(e) => setText(e.target.value)} />
            </p>
            <button className="danger" onClick={() => run(() => post(`/invoices/${id}/dispute`, { reason: text }), "Invoice disputed")}>Dispute</button>
          </>
        )}
        {role === "ANALYST" && inv.status === "ENGINE_EVALUATED" && !inv.recommendation && (
          <>
            <textarea placeholder="Notes" value={text} onChange={(e) => setText(e.target.value)} />
            <p>
              <button onClick={() => run(() => post(`/approvals/${id}/recommend`, { recommendation: "APPROVE", notes: text }), "Recommendation saved")}>Recommend approve</button>
              <button className="danger" onClick={() => run(() => post(`/approvals/${id}/recommend`, { recommendation: "REJECT", notes: text }), "Recommendation saved")}>Recommend reject</button>
            </p>
          </>
        )}
        {role === "APPROVER" && inv.status === "ENGINE_EVALUATED" && (
          inv.recommendation ? (
            <>
              <p className="muted">Analyst recommends: {inv.recommendation}</p>
              <textarea placeholder="Remarks (required)" value={text} onChange={(e) => setText(e.target.value)} />
              <p>
                <button onClick={() => run(() => post(`/approvals/${id}/decision`, { decision: "APPROVE", remarks: text }), "Approved")}>Approve</button>
                <button className="danger" onClick={() => run(() => post(`/approvals/${id}/decision`, { decision: "REJECT", remarks: text }), "Rejected")}>Reject</button>
              </p>
            </>
          ) : <p className="muted">Waiting for an analyst recommendation.</p>
        )}
        {role === "FINANCE_OPS" && inv.status === "APPROVED" && (
          <button onClick={() => run(() => post("/disbursements", { invoiceId: id }, { "Idempotency-Key": idemKey }), "Disbursed")}>Disburse funds</button>
        )}
        {dues && ["BUYER", "FINANCE_OPS", "COLLECTIONS"].includes(role) && (
          <>
            <p>Due now: principal {rupees(dues.principal)}, penal {rupees(dues.penal)}</p>
            <div className="row">
              <div><label>Amount (Rs)</label><input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
              <div><label>UTR reference</label><input value={utr} onChange={(e) => setUtr(e.target.value)} /></div>
            </div>
            <p><button onClick={() => run(() => post("/repayments", { invoiceId: id, amount: Math.round(Number(amount) * 100), utr }), "Repayment recorded")}>Record repayment</button></p>
          </>
        )}
        {!["SUPPLIER", "BUYER", "ANALYST", "APPROVER", "FINANCE_OPS", "COLLECTIONS"].includes(role) && <span className="muted">Read only.</span>}
      </div>

      <Trace evaluation={data.evaluation} />

      <h3>History</h3>
      <table>
        <thead><tr><th>When</th><th>From</th><th>To</th><th>Note</th></tr></thead>
        <tbody>
          {data.events.map((e: any) => (
            <tr key={e._id}><td>{new Date(e.createdAt).toLocaleString("en-IN")}</td><td>{e.from}</td><td>{e.to}</td><td>{e.note}</td></tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
