import Button from '../components/Button'
import DataTable from '../components/DataTable'
import { Field } from '../components/Field'
import FormCard from '../components/FormCard'
import { Grid } from '../components/KpiRow'
import PageHeader from '../components/PageHeader'
import StatusPill from '../components/StatusPill'
import { KYC_DOCS } from '../data/sample'

export default function Onboarding() {
  return (
    <>
      <PageHeader title="Onboarding and KYC" subtitle="Keep your business details and documents current to stay eligible for financing." />
      <Grid>
        <FormCard title="Business details" buttons={<Button type="submit">Save details</Button>}>
          <Field label="Legal name" defaultValue="Kaveri Components Pvt Ltd" />
          <Field label="PAN" defaultValue="AABCK4821M" />
          <Field label="GSTIN" defaultValue="29AABCK4821M1Z5" />
          <Field label="Settlement account number" defaultValue="50100284771920" />
        </FormCard>
        <DataTable
          title="Documents"
          columns={[
            { key: 'doc', header: 'Document' },
            { key: 'uploaded', header: 'Uploaded' },
            { key: 'status', header: 'Status', render: (r) => <StatusPill>{String(r.status)}</StatusPill> },
          ]}
          rows={KYC_DOCS}
        />
      </Grid>
    </>
  )
}
