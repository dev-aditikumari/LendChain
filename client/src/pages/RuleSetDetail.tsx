import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { http } from '../api/http'
import type { BackTest, FactDef, Rule, RuleSet } from '../api/types'
import Button from '../components/Button'
import Card from '../components/Card'
import DataTable from '../components/DataTable'
import Notice from '../components/Notice'
import PageHeader from '../components/PageHeader'
import PricingFields from '../components/PricingFields'
import { Async, ErrorMessage, useMutation, useRequest } from '../components/RequestState'
import RuleForm from '../components/RuleForm'
import StatusPill from '../components/StatusPill'
import { useAuth } from '../auth/AuthContext'
import { money } from '../lib/format'
import { TYPE_LABEL, describeCondition, describeOutcome, isSimple } from '../lib/rules'

type Bundle = { rs: RuleSet; facts: FactDef[] }

const DECISION_KIND = { APPROVE: 'success', REFER: 'warning', REJECT: 'danger' } as const
const STATUS = { PUBLISHED: 'Live', DRAFT: 'Draft', ARCHIVED: 'Archived' } as const

function Editor({ rs, facts, reload }: Bundle & { reload: () => void }) {
  const { user, can } = useAuth()
  const nav = useNavigate()
  const isDraft = rs.status === 'DRAFT'
  const isAuthor = rs.createdBy === user?.id
  const editable = isDraft && isAuthor && can('rule:propose')

  const [rules, setRules] = useState<Rule[]>(rs.rules)
  const [pricing, setPricing] = useState(rs.pricing)
  const [form, setForm] = useState<{ index: number } | null>(null)
  const [test, setTest] = useState<BackTest | null>(null)
  const [done, setDone] = useState('')
  const save = useMutation()
  const discard = useMutation()
  const publish = useMutation()
  const backtest = useMutation()

  useEffect(() => { setRules(rs.rules); setPricing(rs.pricing); setTest(null) }, [rs])
  const dirty = JSON.stringify({ rules, pricing }) !== JSON.stringify({ rules: rs.rules, pricing: rs.pricing })

  const onSave = async () => {
    const r = await save.run(() => http(`/rule-sets/${rs._id}`, { method: 'PUT', body: { rules, pricing } }))
    if (r) { setDone('Changes saved.'); reload() }
  }
  const onDiscard = async () => {
    if (!window.confirm(`Discard draft v${rs.version}? This cannot be undone.`)) return
    const r = await discard.run(() => http(`/rule-sets/${rs._id}`, { method: 'DELETE' }))
    if (r) nav('/rules')
  }
  const onPublish = async () => {
    const r = await publish.run(() => http(`/rule-sets/${rs._id}/publish`, { method: 'POST', body: {} }))
    if (r) { setDone(`Version ${rs.version} is now live. New financing requests use it.`); reload() }
  }
  const onTest = async () => {
    const r = await backtest.run(() => http<BackTest>(`/rule-sets/${rs._id}/simulate`, { method: 'POST', body: {} }))
    if (r) setTest(r)
  }

  const setRule = (index: number, rule: Rule) => {
    setRules((rs) => (index >= rs.length ? [...rs, rule] : rs.map((r, i) => (i === index ? rule : r))))
    setForm(null)
    setDone('')
  }

  return (
    <>
      <PageHeader
        title={`Rule set v${rs.version}`}
        subtitle={`${STATUS[rs.status]} · written by ${rs.createdByName ?? 'built-in rules'}${rs.publishedByName ? ` · published by ${rs.publishedByName}` : ''}`}
        actions={
          <>
            {editable && <Button onClick={onSave} disabled={!dirty || save.busy}>Save changes</Button>}
            {isDraft && can('rule:publish') && !isAuthor && <Button onClick={onPublish} disabled={dirty || publish.busy}>Publish v{rs.version}</Button>}
            {editable && <Button variant="danger" onClick={onDiscard} disabled={discard.busy}>Discard draft</Button>}
          </>
        }
      />
      {done && <Notice kind="success">{done}</Notice>}
      {isDraft && isAuthor && <Notice kind="warning">You wrote this draft, so another Risk Admin has to publish it. Save your changes and run a back-test first.</Notice>}
      {isDraft && !isAuthor && can('rule:publish') && <Notice kind="info">{dirty ? 'Save before publishing.' : 'Check the back-test below, then publish. The author cannot publish their own draft.'}</Notice>}
      {!isDraft && <Notice kind="info">{rs.status === 'PUBLISHED' ? 'This version is live and cannot be changed. Start a new draft from the Rule sets page to change it.' : 'This version was replaced and is kept for the record.'}</Notice>}
      {[save, discard, publish, backtest].map((m, i) => m.error != null && <ErrorMessage key={i} error={m.error} />)}

      <DataTable
        title={`Rules (${rules.length})`}
        action={editable ? <Button onClick={() => setForm({ index: rules.length })}>Add rule</Button> : undefined}
        columns={[
          { key: 'id', header: 'Rule', render: (r) => <b>{r.id}</b> },
          { key: 'type', header: 'Type', render: (r) => TYPE_LABEL[r.type] },
          { key: 'when', header: 'When', render: (r) => describeCondition(r.when, facts) },
          { key: 'then', header: 'Then', render: (r) => describeOutcome(r) },
          ...(editable ? [{
            key: 'actions', header: '', align: 'right' as const,
            render: (r: Rule) => (
              <span className="inline-flex gap-2">
                <Button variant="row" disabled={!isSimple(r.when)} title={isSimple(r.when) ? undefined : 'This rule has nested conditions and cannot be edited here'} onClick={() => setForm({ index: rules.indexOf(r) })}>Edit</Button>
                <Button variant="row" onClick={() => { setRules((x) => x.filter((y) => y !== r)); setDone('') }}>Remove</Button>
              </span>
            ),
          }] : []),
        ]}
        rows={rules}
        rowKey={(r) => r.id}
        empty="No rules. Every invoice would be scored 0 and rejected."
      />
      {editable && form && (
        <RuleForm
          key={form.index}
          facts={facts}
          initial={rules[form.index]}
          takenIds={rules.filter((_, i) => i !== form.index).map((r) => r.id)}
          onSave={(rule) => setRule(form.index, rule)}
          onCancel={() => setForm(null)}
        />
      )}

      {editable ? <PricingFields value={pricing} onChange={(p) => { setPricing(p); setDone('') }} /> : (
        <Card title="Pricing">
          <p className="m-0 text-muted">
            Base rate {rs.pricing.baseRate}%, fee {rs.pricing.feePercent}% (minimum {money(rs.pricing.minFee)}), advance {rs.pricing.defaultAdvancePercent}%,
            approve at score {rs.pricing.approveScore}, refer at {rs.pricing.referScore}.
          </p>
        </Card>
      )}

      {isDraft && can('rule:propose') && (
        <Card title="Back-test" action={<Button variant="secondary" onClick={onTest} disabled={backtest.busy || dirty}>{dirty ? 'Save to back-test' : 'Run back-test'}</Button>}>
          {!test ? (
            <p className="m-0 text-muted">Runs the live rules and this draft over recent financing requests, using the facts recorded at the time, and shows what would change.</p>
          ) : (
            <BackTestResult test={test} />
          )}
        </Card>
      )}
    </>
  )
}

function BackTestResult({ test }: { test: BackTest }) {
  if (test.total === 0) return <p className="m-0 text-muted">No financing requests have been evaluated yet, so there is nothing to compare.</p>
  const changed = test.rows.filter((r) => r.changed)
  return (
    <div className="grid gap-4">
      <Notice kind={test.changed ? 'warning' : 'success'}>
        {test.changed === 0
          ? `All ${test.total} recent requests would get the same decision.`
          : `${test.changed} of ${test.total} recent requests would get a different decision.`}
      </Notice>
      <div className="grid gap-4">
        <DataTable
          title="Outcome counts"
          columns={[
            { key: 'metric', header: 'Metric' },
            { key: 'live', header: `Live v${test.liveVersion}`, align: 'right' },
            { key: 'draft', header: `Draft v${test.draftVersion}`, align: 'right' },
          ]}
          rows={[
            { metric: 'Approved', live: test.live.approve, draft: test.draft.approve },
            { metric: 'Referred', live: test.live.refer, draft: test.draft.refer },
            { metric: 'Rejected', live: test.live.reject, draft: test.draft.reject },
            { metric: 'Average rate (decided)', live: `${test.live.avgRate}%`, draft: `${test.draft.avgRate}%` },
          ]}
          rowKey={(r) => r.metric}
        />
        <DataTable
          title="Changed decisions"
          columns={[
            { key: 'number', header: 'Invoice', render: (r) => <b>{r.number ?? '-'}</b> },
            { key: 'amount', header: 'Amount', align: 'right', render: (r) => money(r.amount) },
            { key: 'before', header: 'Live', render: (r) => <StatusPill kind={DECISION_KIND[r.before.decision]}>{r.before.decision}</StatusPill> },
            { key: 'after', header: 'Draft', render: (r) => <StatusPill kind={DECISION_KIND[r.after.decision]}>{r.after.decision}</StatusPill> },
          ]}
          rows={changed}
          rowKey={(r) => r.invoiceId}
          empty="No decision changes."
        />
      </div>
    </div>
  )
}

const loadBundle = (id: string) => async (): Promise<Bundle> => {
  const [rs, facts] = await Promise.all([http<RuleSet>(`/rule-sets/${id}`), http<FactDef[]>('/rule-sets/facts')])
  return { rs, facts }
}

export default function RuleSetDetail() {
  const { id = '' } = useParams()
  const req = useRequest(loadBundle(id), id)
  return <Async req={req}>{(b) => <Editor rs={b.rs} facts={b.facts} reload={req.reload} />}</Async>
}
