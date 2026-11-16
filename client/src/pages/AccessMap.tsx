import { http } from '../api/http'
import PageHeader from '../components/PageHeader'
import PermissionMatrix from '../components/PermissionMatrix'
import { ErrorMessage, useRequest } from '../components/RequestState'
import { sectionMatrix } from '../lib/access'
import type { ServerRole } from '../lib/serverRoles'

const load = () => http<Record<ServerRole, string[]>>('/access/roles')

export default function AccessMap() {
  const { data, error, loading } = useRequest(load)
  return (
    <>
      <PageHeader title="Access map" subtitle="Which sections each role can see. The server enforces the same rules." />
      {error ? <ErrorMessage error={error} /> : null}
      {loading && <p className="m-0 text-muted">Loading...</p>}
      {data && <PermissionMatrix title="Section visibility" rowLabel="Section" data={sectionMatrix(data)} />}
    </>
  )
}
