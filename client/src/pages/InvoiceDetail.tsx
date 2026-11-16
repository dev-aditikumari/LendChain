import { useParams } from 'react-router-dom'
import Card from '../components/Card'
import DataTable from '../components/DataTable'
import KeyValueCard from '../components/KeyValueCard'
import { Grid } from '../components/KpiRow'
import PageHeader from '../components/PageHeader'
import Stepper from '../components/Stepper'
import StatusPill from '../components/StatusPill'
import Timeline from '../components/Timeline'
import { INVOICE_STATES, INVOICE_TIMELINE, SUPPLIER_DOCS, SUPPLIER_INVOICES } from '../data/sample'
import { inr } from '../lib/format'

export default function InvoiceDetail() {
  const { id } = useParams()
  const inv = SUPPLIER_INVOICES.find((i) => i.id === id) ?? SUPPLIER_INVOICES[0]
  return (
    <>
      <PageHeader title={`Invoice ${inv.id}`} subtitle={`Raised against ${inv.buyer}.`} actions={<StatusPill kind={inv.kind}>{inv.status}</StatusPill>} />
      <Card title="Progress"><Stepper steps={INVOICE_STATES} current={5} /></Card>
      <Grid>
        <KeyValueCard
          title="Invoice details"
          rows={[
            ['Buyer', inv.buyer],
            ['Amount', inr(inv.amount)],
            ['Issue date', '02 Nov 2026'],
            ['Due date', inv.due],
            ['Advance requested', '90%'],
            ['Tenure', '45 days'],
          ]}
        />
        <Card title="Activity"><Timeline items={INVOICE_TIMELINE} /></Card>
      </Grid>
      <DataTable
        title="Documents"
        columns={[
          { key: 'name', header: 'Document' },
          { key: 'file', header: 'File' },
          { key: 'status', header: 'Status', render: (r) => <StatusPill>{String(r.status)}</StatusPill> },
        ]}
        rows={SUPPLIER_DOCS}
      />
    </>
  )
}
