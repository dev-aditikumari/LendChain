import Button from '../components/Button'
import DataTable from '../components/DataTable'
import FormCard from '../components/FormCard'
import { Grid } from '../components/KpiRow'
import PageHeader from '../components/PageHeader'
import { NOTIFICATIONS } from '../data/sample'

function Toggle({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
      <span>{label}</span>
      <input type="checkbox" defaultChecked={defaultChecked} className="size-5 accent-violet" />
    </label>
  )
}

export default function Notifications() {
  return (
    <>
      <PageHeader title="Notifications" subtitle="What happened today and how you hear about it." />
      <Grid>
        <DataTable
          title="Today"
          columns={[
            { key: 'time', header: 'Time' },
            { key: 'event', header: 'Event' },
            { key: 'channel', header: 'Sent via' },
          ]}
          rows={NOTIFICATIONS}
        />
        <FormCard title="Delivery settings" buttons={<Button type="submit">Save settings</Button>}>
          <Toggle label="Email" defaultChecked />
          <Toggle label="SMS for disputes and payouts" defaultChecked />
          <Toggle label="In-app" defaultChecked />
          <Toggle label="Weekly summary" />
        </FormCard>
      </Grid>
    </>
  )
}
