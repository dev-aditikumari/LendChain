import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function NewInvoice() {
  const nav = useNavigate();
  const [programs, setPrograms] = useState<any[]>([]);
  const [buyers, setBuyers] = useState<any[]>([]);
  const [form, setForm] = useState({ number: "", buyerId: "", amount: "", issueDate: "", dueDate: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    api("/programs").then(setPrograms).catch(() => {});
    api("/entities?kind=BUYER").then(setBuyers).catch(() => {});
  }, []);

  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });
  const myBuyers = buyers.filter((b) => programs.some((p) => p.buyerId === b._id));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const inv = await api("/invoices", {
        body: { ...form, amount: Math.round(Number(form.amount) * 100) },
      });
      nav(`/invoices/${inv._id}`);
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <>
      <h2>New invoice</h2>
      <form className="box" onSubmit={submit}>
        <label>Invoice number</label>
        <input value={form.number} onChange={set("number")} required />
        <label>Buyer</label>
        <select value={form.buyerId} onChange={set("buyerId")} required>
          <option value="">Select buyer</option>
          {myBuyers.map((b) => <option key={b._id} value={b._id}>{b.legalName}</option>)}
        </select>
        <label>Amount (Rs)</label>
        <input type="number" min="1" step="0.01" value={form.amount} onChange={set("amount")} required />
        <div className="row">
          <div><label>Issue date</label><input type="date" value={form.issueDate} onChange={set("issueDate")} required /></div>
          <div><label>Due date</label><input type="date" value={form.dueDate} onChange={set("dueDate")} required /></div>
        </div>
        {error && <div className="err">{error}</div>}
        <p><button type="submit">Save draft</button></p>
      </form>
    </>
  );
}
