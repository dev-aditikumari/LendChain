export default function Trace({ evaluation }: { evaluation: any }) {
  if (!evaluation) return null;
  const r = evaluation.result;
  return (
    <div className="box">
      <h3 style={{ marginTop: 0 }}>Rule engine result</h3>
      <p>
        Decision: <b>{r.decision}</b> | Score: <b>{r.score}</b> | Rate: <b>{r.rate}%</b> | Advance: <b>{r.advancePercent}%</b> | Fee: <b>Rs {(r.fee / 100).toFixed(2)}</b>
      </p>
      <p className="muted">Rule set version {evaluation.ruleSetVersion}{r.reasons.length ? ` | Reasons: ${r.reasons.join(", ")}` : ""}</p>
      <table>
        <thead><tr><th>Rule</th><th>Type</th><th>Inputs</th><th>Fired</th></tr></thead>
        <tbody>
          {r.trace.map((t: any) => (
            <tr key={t.ruleId} className={t.fired ? "fired" : ""}>
              <td>{t.ruleId}</td>
              <td>{t.type}</td>
              <td>{Object.entries(t.inputs).map(([k, v]) => `${k}=${String(v)}`).join(", ")}</td>
              <td>{t.fired ? "yes" : "no"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
