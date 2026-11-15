import { Link, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import Login from "./pages/Login";
import Invoices from "./pages/Invoices";
import InvoiceDetail from "./pages/InvoiceDetail";
import NewInvoice from "./pages/NewInvoice";
import Queue from "./pages/Queue";

export default function App() {
  const { user, logout } = useAuth();
  if (!user) return <Login />;

  const reviewer = user.role === "ANALYST" || user.role === "APPROVER";
  return (
    <>
      <header className="bar">
        <b>LendChain</b>
        <nav>
          <Link to="/invoices">Invoices</Link>
          {user.role === "SUPPLIER" && <Link to="/invoices/new">New invoice</Link>}
          {reviewer && <Link to="/queue">Review queue</Link>}
        </nav>
        <span className="who">{user.name} ({user.role})</span>
        <button className="link" onClick={logout}>Log out</button>
      </header>
      <main>
        <Routes>
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/invoices/new" element={<NewInvoice />} />
          <Route path="/invoices/:id" element={<InvoiceDetail />} />
          <Route path="/queue" element={<Queue />} />
          <Route path="*" element={<Navigate to="/invoices" />} />
        </Routes>
      </main>
    </>
  );
}
