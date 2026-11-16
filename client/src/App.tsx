import type { ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import AppShell from './layout/AppShell'
import { HOME } from './lib/permissions'
import AccessMap from './pages/AccessMap'
import Accruals from './pages/Accruals'
import Ageing from './pages/Ageing'
import AnalystQueue from './pages/AnalystQueue'
import ApproverReview from './pages/ApproverReview'
import AuditLog from './pages/AuditLog'
import BuyerInbox from './pages/BuyerInbox'
import CreateInvoice from './pages/CreateInvoice'
import DisputeThread from './pages/DisputeThread'
import Disbursements from './pages/Disbursements'
import Exceptions from './pages/Exceptions'
import FinancingOffer from './pages/FinancingOffer'
import InvoiceDetail from './pages/InvoiceDetail'
import Ledger from './pages/Ledger'
import Login from './pages/Login'
import Notifications from './pages/Notifications'
import Onboarding from './pages/Onboarding'
import PeriodClose from './pages/PeriodClose'
import Placeholder from './pages/Placeholder'
import PortfolioOverview from './pages/PortfolioOverview'
import PricingGrid from './pages/PricingGrid'
import Programs from './pages/Programs'
import Reconciliation from './pages/Reconciliation'
import RuleEditor from './pages/RuleEditor'
import SupplierDashboard from './pages/SupplierDashboard'
import TrialBalance from './pages/TrialBalance'
import UsersRoles from './pages/UsersRoles'

// the screen shows only when the signed-in role can see the section
function Guard({ section, children }: { section: string; children: ReactElement }) {
  const { user, ready, section: level } = useAuth()
  if (!ready) return null
  if (!user) return <Navigate to="/login" replace />
  if (level(section) === 'none') return <Navigate to={HOME[user.role]} replace />
  return children
}

const g = (section: string, el: ReactElement) => <Guard section={section}>{el}</Guard>

export default function App() {
  const { user, ready } = useAuth()
  if (!ready) return <p className="p-8 text-muted">Loading...</p>
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={user ? <AppShell /> : <Navigate to="/login" replace />}>
        <Route path="/dashboard" element={g('Dashboard', <SupplierDashboard />)} />
        <Route path="/onboarding" element={g('Dashboard', <Onboarding />)} />
        <Route path="/notifications" element={g('Dashboard', <Notifications />)} />
        <Route path="/invoices/new" element={g('Invoices', <CreateInvoice />)} />
        <Route path="/invoices/:id" element={g('Invoices', <InvoiceDetail />)} />
        <Route path="/financing" element={g('Financing', <FinancingOffer />)} />
        <Route path="/inbox" element={g('Invoices', <BuyerInbox />)} />
        <Route path="/disputes" element={g('Invoices', <DisputeThread />)} />
        <Route path="/queue" element={g('Approvals', <AnalystQueue />)} />
        <Route path="/review" element={g('Approvals', <ApproverReview />)} />
        <Route path="/disbursements" element={g('Disbursement', <Disbursements />)} />
        <Route path="/ledger" element={g('Ledger', <Ledger />)} />
        <Route path="/exceptions" element={g('Exceptions', <Exceptions />)} />
        <Route path="/reconciliation" element={g('Reconciliation', <Reconciliation />)} />
        <Route path="/trial-balance" element={g('Trial balance / close', <TrialBalance />)} />
        <Route path="/accruals" element={g('Trial balance / close', <Accruals />)} />
        <Route path="/period-close" element={g('Trial balance / close', <PeriodClose />)} />
        <Route path="/ageing" element={g('Collections', <Ageing />)} />
        <Route path="/rules" element={g('Rule engine', <RuleEditor />)} />
        <Route path="/pricing" element={g('Rule engine', <PricingGrid />)} />
        <Route path="/overview" element={g('Dashboard', <PortfolioOverview />)} />
        <Route path="/programs" element={g('Dashboard', <Programs />)} />
        <Route path="/users" element={g('Users and roles', <UsersRoles />)} />
        <Route path="/access" element={g('Users and roles', <AccessMap />)} />
        <Route path="/audit" element={g('Audit log', <AuditLog />)} />
        <Route path="/p/:slug" element={<Placeholder />} />
      </Route>
      <Route path="*" element={<Navigate to={user ? HOME[user.role] : '/login'} replace />} />
    </Routes>
  )
}
