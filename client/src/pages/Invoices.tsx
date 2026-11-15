import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, date, rupees } from "../api";

export default function Invoices() {
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const nav = useNavigate();

  useEffect(() => {
    api(`/invoices${status ? `?status=${status}` : ""}`)
      .then((r) => setItems(r.items))
      .catch((e) => setError(e.message));
  }, [status]);

  return (
    <>
      <h2>Invoices</h2>
      <p>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 220 }}>
          <option value="">All statuses</option>
          {["DRAFT", "SUBMITTED", "BUYER_CONFIRMED", "ENGINE_EVALUATED", "APPROVED", "DISBURSED", "OVERDUE", "REPAID", "REJECTED", "DISPUTED"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </p>
      {error && <div className="err">{error}</div>}
      <table>
        <thead>
          <tr><th>Number</th><th>Amount</th><th>Due date</th><th>Status</th></tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i._id} className="click" onClick={() => nav(`/invoices/${i._id}`)}>
              <td>{i.number}</td>
              <td>{rupees(i.amount)}</td>
              <td>{date(i.dueDate)}</td>
              <td><span className="tag">{i.status}</span></td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={4}>No invoices found.</td></tr>}
        </tbody>
      </table>
    </>
  );
}
