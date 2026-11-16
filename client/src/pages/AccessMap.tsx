import PageHeader from '../components/PageHeader'
import PermissionMatrix from '../components/PermissionMatrix'
import { SECTIONS } from '../lib/permissions'

export default function AccessMap() {
  return (
    <>
      <PageHeader title="Access map" subtitle="Which sections each role can see. The server enforces the same rules." />
      <PermissionMatrix title="Section visibility" rowLabel="Section" data={SECTIONS} />
    </>
  )
}
