import Button from '../components/Button'
import DataTable from '../components/DataTable'
import { Field, SelectField } from '../components/Field'
import FormCard from '../components/FormCard'
import { Grid } from '../components/KpiRow'
import PageHeader from '../components/PageHeader'
import StatusPill from '../components/StatusPill'
import { ACCRUALS } from '../data/sample'
import { useAuth } from '../auth/AuthContext'
import { inr } from '../lib/format'

export default function Accruals() {
  const { can } = useAuth()
  const canPost = can('journal:post')
  return (
    <>
      <PageHeader title="Accruals" subtitle="Monthly discount accrual runs." />
      <Grid>
        <DataTable
          title="Accrual runs"
          columns={[
            { key: 'run', header: 'Run', render: (r) => <b>{r.run}</b> },
            { key: 'period', header: 'Period' },
            { key: 'invoices', header: 'Invoices', align: 'right' },
            { key: 'amount', header: 'Amount', align: 'right', render: (r) => inr(Number(r.amount)) },
            { key: 'status', header: 'Status', render: (r) => <StatusPill>{String(r.status)}</StatusPill> },
            { key: 'act', header: 'Action', render: (r) => (canPost && r.status === 'Pending' ? <Button variant="row">Post</Button> : null) },
          ]}
          rows={ACCRUALS}
        />
        <FormCard title="Settings" buttons={<Button type="submit" disabled={!canPost}>Save settings</Button>}>
          <SelectField label="Day count" defaultValue="365">
            <option value="365">Actual / 365</option>
            <option value="360">Actual / 360</option>
          </SelectField>
          <Field label="Penal rate (% a year over contract)" type="number" defaultValue={2} />
          <Field label="Grace days" type="number" defaultValue={3} />
        </FormCard>
      </Grid>
    </>
  )
}
