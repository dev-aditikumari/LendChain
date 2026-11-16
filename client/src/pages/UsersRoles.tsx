import PageHeader from '../components/PageHeader'
import PermissionMatrix from '../components/PermissionMatrix'
import { ACTIONS } from '../lib/permissions'

export default function UsersRoles() {
  return (
    <>
      <PageHeader title="Users and roles" subtitle="What each role can do. Changes are audited." />
      <PermissionMatrix title="Action permissions" rowLabel="Action" data={ACTIONS} />
    </>
  )
}
