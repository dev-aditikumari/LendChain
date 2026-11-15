import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, date, rupees } from "../api";

export default function Queue() {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState("");
  const nav = useNavigate();

  useEffect(() => {
    api("/approvals/queue").then(setItems).catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <h2>Review queue</h2>
      {error && <div className="err">{error}</div>}
      <table>
        <thead><tr><th>Number</th><th>Financed</th><th>Due</th><th>Recommendation</th></tr></thead>
        <tbody>
          {items.map((i) => (
            <tr key={i._id} className="click" onClick={() => nav(`/invoices/${i._id}`)}>
              <td>{i.number}</td><td>{rupees(i.financedAmount || 0)}</td><td>{date(i.dueDate)}</td><td>{i.recommendation || "pending"}</td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={4}>Nothing waiting.</td></tr>}
        </tbody>
      </table>
    </>
  );
}
