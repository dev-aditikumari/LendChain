import { useNavigate } from 'react-router-dom'
import { http } from '../api/http'
import type { RuleSet } from '../api/types'
import Button from '../components/Button'
import DataTable from '../components/DataTable'
import Notice from '../components/Notice'
import PageHeader from '../components/PageHeader'
import { Async, ErrorMessage, useMutation, useRequest } from '../components/RequestState'
import StatusPill, { type PillKind } from '../components/StatusPill'
import { useAuth } from '../auth/AuthContext'
import { dateTime } from '../lib/format'

const load = () => http<RuleSet[]>('/rule-sets')

const STATUS: Record<RuleSet['status'], { label: string; kind: PillKind }> = {
  PUBLISHED: { label: 'Live', kind: 'success' },
  DRAFT: { label: 'Draft', kind: 'warning' },
  ARCHIVED: { label: 'Archived', kind: 'neutral' },
}

export default function RuleEditor() {
  const { can } = useAuth()
  const nav = useNavigate()
  const req = useRequest(load)
  const create = useMutation()
  const canEdit = can('rule:propose')

  const startDraft = (live: RuleSet) =>
    create.run(async () => {
      const draft = await http<RuleSet>('/rule-sets', { body: { rules: live.rules, pricing: live.pricing } })
      nav(`/rules/${draft._id}`)
    })

  return (
    <>
      <PageHeader title="Rule sets" subtitle="The rules the engine applies to every financing request, and the drafts waiting to replace them." />
      <Async req={req}>
        {(sets) => {
          const live = sets.find((s) => s.status === 'PUBLISHED')
          return (
            <>
              {live ? (
                <Notice kind="info">
                  Version {live.version} is live. It was published{live.publishedByName ? ` by ${live.publishedByName}` : ''}; every new financing request is decided with it.
                </Notice>
              ) : (
                <Notice kind="warning">No rule set is live yet. The first financing request will create version 1 from the built-in rules.</Notice>
              )}
              {create.error != null && <ErrorMessage error={create.error} />}
              <DataTable
                title="Versions"
                action={canEdit && live ? <Button disabled={create.busy} onClick={() => startDraft(live)}>New draft from v{live.version}</Button> : undefined}
                columns={[
                  { key: 'version', header: 'Version', render: (s) => <b>v{s.version}</b> },
                  { key: 'status', header: 'Status', render: (s) => <StatusPill kind={STATUS[s.status].kind}>{STATUS[s.status].label}</StatusPill> },
                  { key: 'rules', header: 'Rules', align: 'right', render: (s) => String(s.rules.length) },
                  { key: 'createdByName', header: 'Written by', render: (s) => s.createdByName ?? 'Built-in' },
                  { key: 'publishedByName', header: 'Published by', render: (s) => s.publishedByName ?? '-' },
                  { key: 'createdAt', header: 'Created', render: (s) => dateTime(s.createdAt) },
                  { key: 'open', header: '', align: 'right', render: (s) => <Button variant="row" onClick={() => nav(`/rules/${s._id}`)}>{s.status === 'DRAFT' ? 'Open draft' : 'View'}</Button> },
                ]}
                rows={sets}
                rowKey={(s) => s._id}
                empty="No rule sets yet."
              />
            </>
          )
        }}
      </Async>
    </>
  )
}
