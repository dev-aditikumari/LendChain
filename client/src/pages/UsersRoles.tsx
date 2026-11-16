import { http } from '../api/http'
import PageHeader from '../components/PageHeader'
import PermissionMatrix from '../components/PermissionMatrix'
import { ErrorMessage, useRequest } from '../components/RequestState'
import { actionMatrix } from '../lib/access'
import type { ServerRole } from '../lib/serverRoles'

const load = () => http<Record<ServerRole, string[]>>('/access/roles')

export default function UsersRoles() {
  const { data, error, loading } = useRequest(load)
  return (
    <>
      <PageHeader title="Users and roles" subtitle="What each role can do, read from the server. Changes are audited." />
      {error ? <ErrorMessage page error={error} /> : null}
      {loading && <p className="m-0 text-muted">Loading...</p>}
      {data && <PermissionMatrix title="Action permissions" rowLabel="Action" data={actionMatrix(data)} />}
    </>
  )
}
