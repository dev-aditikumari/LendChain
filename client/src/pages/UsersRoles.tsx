import { useState } from 'react'
import { http } from '../api/http'
import type { UserRow } from '../api/types'
import Button from '../components/Button'
import DataTable from '../components/DataTable'
import { Field, SelectField } from '../components/Field'
import FormCard from '../components/FormCard'
import Notice from '../components/Notice'
import PageHeader from '../components/PageHeader'
import PermissionMatrix from '../components/PermissionMatrix'
import { Async, ErrorMessage, useMutation, useRequest } from '../components/RequestState'
import StatusPill from '../components/StatusPill'
import { useAuth } from '../auth/AuthContext'
import { actionMatrix } from '../lib/access'
import { ROLE_LABEL } from '../lib/permissions'
import { ROLE_KEY, SERVER_ROLES, type ServerRole } from '../lib/serverRoles'

interface Entity { _id: string; kind: 'SUPPLIER' | 'BUYER'; legalName: string }

const loadUsers = () => http<UserRow[]>('/users')
const loadRoles = () => http<Record<ServerRole, string[]>>('/access/roles')
const loadEntities = () => http<Entity[]>('/entities')
const label = (r: string) => ROLE_LABEL[ROLE_KEY[r as ServerRole]] ?? r
const needsCompany = (r: string) => r === 'SUPPLIER' || r === 'BUYER'

export default function UsersRoles() {
  const { user: me } = useAuth()
  const users = useRequest(loadUsers)
  const roles = useRequest(loadRoles)
  const entities = useRequest(loadEntities)
  const m = useMutation()
  const [done, setDone] = useState('')
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'ANALYST', entityId: '' })
  const [resetFor, setResetFor] = useState<UserRow | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const act = async (fn: () => Promise<unknown>, message: string) => {
    setDone('')
    const r = await m.run(fn)
    if (r !== undefined) { setDone(message); users.reload() }
    return r
  }
  const create = async () => {
    const body: Record<string, unknown> = { name: form.name, email: form.email, password: form.password, role: form.role }
    if (needsCompany(form.role)) body.entityId = form.entityId
    const r = await act(() => http('/users', { body }), `${form.name} can now sign in.`)
    if (r !== undefined) setForm({ name: '', email: '', password: '', role: 'ANALYST', entityId: '' })
  }
  const patch = (u: UserRow, body: object, message: string) => act(() => http(`/users/${u.id}`, { method: 'PATCH', body }), message)
  const reset = async () => {
    if (!resetFor) return
    const r = await act(() => http(`/users/${resetFor.id}/password`, { body: { password: newPassword } }), `New password set for ${resetFor.name}. They were signed out.`)
    if (r !== undefined) { setResetFor(null); setNewPassword('') }
  }
  const companies = (entities.data ?? []).filter((e) => e.kind === form.role)

  return (
    <>
      <PageHeader title="Users and roles" subtitle="Who can sign in and what each role can do. Every change is audited and signs the person out." />
      {done && <Notice kind="success">{done}</Notice>}
      {m.error != null && <ErrorMessage error={m.error} />}
      <Async req={users}>
        {(rows) => (
          <>
            <FormCard
              title="Add a user"
              onSubmit={create}
              buttons={<Button type="submit" disabled={m.busy}>{m.busy ? 'Saving...' : 'Add user'}</Button>}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name" value={form.name} onChange={set('name')} required minLength={2} />
                <Field label="Email" type="email" value={form.email} onChange={set('email')} required />
                <Field label="Starting password" type="text" value={form.password} onChange={set('password')} required minLength={8} hint="At least 8 characters. Tell them to keep it private." />
                <SelectField label="Role" value={form.role} onChange={set('role')}>
                  {SERVER_ROLES.map((r) => <option key={r} value={r}>{label(r)}</option>)}
                </SelectField>
                {needsCompany(form.role) && (
                  <SelectField label="Company" value={form.entityId} onChange={set('entityId')} required>
                    <option value="">Choose a company</option>
                    {companies.map((e) => <option key={e._id} value={e._id}>{e.legalName}</option>)}
                  </SelectField>
                )}
              </div>
            </FormCard>
            {resetFor && (
              <FormCard
                title={`New password for ${resetFor.name}`}
                onSubmit={reset}
                buttons={<><Button type="submit" disabled={m.busy}>Set password</Button><Button variant="secondary" onClick={() => setResetFor(null)}>Cancel</Button></>}
              >
                <Field label="New password" type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
              </FormCard>
            )}
            <DataTable
              title={`Users (${rows.length})`}
              columns={[
                { key: 'name', header: 'Person', render: (r) => <span><b>{r.name}</b><span className="block text-xs text-muted">{r.email}</span></span> },
                { key: 'role', header: 'Role', render: (r) => label(r.role) },
                { key: 'company', header: 'Company', render: (r) => r.entityName ?? '-' },
                { key: 'status', header: 'Status', render: (r) => (r.active ? (r.locked ? <StatusPill kind="warning">Locked</StatusPill> : <StatusPill kind="success">Active</StatusPill>) : <StatusPill kind="neutral">Deactivated</StatusPill>) },
                {
                  key: 'act', header: 'Action',
                  render: (r) => {
                    const self = r.id === me?.id
                    return (
                      <span className="inline-flex flex-wrap items-center gap-2">
                        {!self && (
                          <select
                            aria-label={`Change role for ${r.name}`}
                            value={r.role}
                            disabled={m.busy}
                            onChange={(e) => patch(r, { role: e.target.value }, `${r.name} is now ${label(e.target.value)}.`)}
                            className="min-h-11 rounded-[10px] border border-input-border bg-white/90 px-2"
                          >
                            {SERVER_ROLES.filter((x) => !needsCompany(x) || x === r.role).map((x) => <option key={x} value={x}>{label(x)}</option>)}
                          </select>
                        )}
                        {r.locked && <Button variant="row" disabled={m.busy} onClick={() => act(() => http(`/users/${r.id}/unlock`, { body: {} }), `${r.name} is unlocked.`)}>Unlock</Button>}
                        <Button variant="row" disabled={m.busy} onClick={() => { setResetFor(r); setNewPassword(''); setDone(''); m.clear() }}>Reset password</Button>
                        {!self && <Button variant="row" disabled={m.busy} onClick={() => patch(r, { active: !r.active }, r.active ? `${r.name} is deactivated and signed out.` : `${r.name} can sign in again.`)}>{r.active ? 'Deactivate' : 'Reactivate'}</Button>}
                      </span>
                    )
                  },
                },
              ]}
              rows={rows}
              rowKey={(r) => r.id}
              empty="There are no users yet."
            />
          </>
        )}
      </Async>
      <Async req={roles}>{(data) => <PermissionMatrix title="Action permissions" rowLabel="Action" data={actionMatrix(data)} />}</Async>
    </>
  )
}
