import { type FormEvent, useState } from "react";
import { useAuth } from "../auth";

const demo = [
  ["supplier@lendchain.test", "Supplier"],
  ["buyer@lendchain.test", "Buyer"],
  ["analyst@lendchain.test", "Analyst"],
  ["approver@lendchain.test", "Approver"],
  ["ops@lendchain.test", "Finance ops"],
  ["collections@lendchain.test", "Collections"],
  ["risk1@lendchain.test", "Risk admin"],
  ["admin@lendchain.test", "Admin"],
];

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="login box">
      <h2>LendChain login</h2>
      <form onSubmit={submit}>
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        <label>Password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        {error && <div className="err">{error}</div>}
        <p><button type="submit">Log in</button></p>
      </form>
      <p className="muted">Demo users (local seed data):</p>
      <p className="muted">
        {demo.map(([e, n]) => (
          <button key={e} type="button" className="plain" onClick={() => setEmail(e)}>{n}</button>
        ))}
      </p>
    </div>
  );
}
