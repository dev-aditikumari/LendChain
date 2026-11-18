import { useParams } from 'react-router-dom'
import Card from '../components/Card'
import PageHeader from '../components/PageHeader'

const PLANNED: Record<string, string> = {
  repayments: 'Repayments due and received per invoice, with a form to record a repayment.',
  payables: 'Confirmed invoices the buyer owes, grouped by due date.',
  'kyc-checks': 'Supplier KYC documents waiting for the analyst to verify.',
  decisions: 'Past recommendations with the engine result they were based on.',
  approved: 'Invoices this approver has approved, with remarks.',
  rejected: 'Invoices this approver has rejected, with reasons.',
  limits: 'Approval limits and program limits, with the amounts that escalate.',
  'master-data': 'Buyers, suppliers and bank accounts that other screens depend on.',
  settlements: 'Settlement files and their match against payouts.',
  'tax-gst': 'GST on fees and the journals that book it.',
  'follow-ups': 'Calls and reminders logged against overdue invoices.',
  overdue: 'Every overdue invoice with promise-to-pay dates.',
  settings: 'Platform settings such as notification templates and sign-in rules.',
}

export default function Placeholder() {
  const { slug = '' } = useParams()
  const title = slug.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase())
  return (
    <>
      <PageHeader title={title} subtitle="Coming soon." />
      <Card title="Planned for this page">
        <p className="m-0 text-muted">{PLANNED[slug] ?? 'This page has no design yet.'}</p>
      </Card>
    </>
  )
}
