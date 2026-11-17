import { useState } from 'react'
import type { Condition, FactDef, Op, Rule } from '../api/types'
import { OP_LABEL, TYPE_LABEL, isLeaf, opsFor, parseValue, valueToText } from '../lib/rules'
import { toPaise } from '../lib/format'
import Button from './Button'
import { Field, SelectField } from './Field'
import FormCard from './FormCard'
import Notice from './Notice'

interface Row { fact: string; op: Op; text: string }
type Mode = 'single' | 'all' | 'any'

function rowsOf(c: Condition | undefined, facts: FactDef[]): { mode: Mode; rows: Row[] } {
  if (!c) return { mode: 'single', rows: [{ fact: facts[0].key, op: opsFor(facts[0].kind)[0], text: '' }] }
  if (isLeaf(c)) return { mode: 'single', rows: [{ fact: c.fact, op: c.op, text: valueToText(c.value) }] }
  const kids = ('all' in c ? c.all : c.any).filter(isLeaf)
  return { mode: 'all' in c ? 'all' : 'any', rows: kids.map((k) => ({ fact: k.fact, op: k.op, text: valueToText(k.value) })) }
}

interface Props {
  facts: FactDef[]
  initial?: Rule
  takenIds: string[]
  onSave: (rule: Rule) => void
  onCancel: () => void
}

export default function RuleForm({ facts, initial, takenIds, onSave, onCancel }: Props) {
  const start = rowsOf(initial?.when, facts)
  const [id, setId] = useState(initial?.id ?? '')
  const [type, setType] = useState<Rule['type']>(initial?.type ?? 'scoring')
  const [mode, setMode] = useState<Mode>(start.mode)
  const [rows, setRows] = useState<Row[]>(start.rows)
  const [reason, setReason] = useState(initial?.then.reason ?? '')
  const [points, setPoints] = useState(String(initial?.then.points ?? ''))
  const [rate, setRate] = useState(String(initial?.then.rate ?? ''))
  const [fee, setFee] = useState(initial?.then.fee !== undefined ? String(initial.then.fee / 100) : '')
  const [advance, setAdvance] = useState(String(initial?.then.advancePercent ?? ''))
  const [problem, setProblem] = useState('')

  const kindOf = (key: string) => facts.find((f) => f.key === key)?.kind ?? 'text'
  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  const changeFact = (i: number, fact: string) => {
    const ops = opsFor(kindOf(fact))
    setRow(i, { fact, op: ops.includes(rows[i].op) ? rows[i].op : ops[0], text: kindOf(fact) === 'boolean' ? 'true' : '' })
  }

  function submit() {
    const ruleId = id.trim()
    if (!/^[A-Za-z0-9_-]{2,40}$/.test(ruleId)) return setProblem('Rule id: letters, digits, - and _ (2 to 40 characters).')
    if (takenIds.includes(ruleId)) return setProblem('Another rule already uses this id.')
    const leaves: Condition[] = []
    for (const r of rows) {
      const value = parseValue(r.op, kindOf(r.fact), r.text)
      if (value === null) return setProblem(`Check the value for "${facts.find((f) => f.key === r.fact)?.label}".`)
      leaves.push({ fact: r.fact, op: r.op, value })
    }
    const when: Condition = mode === 'single' ? leaves[0] : mode === 'all' ? { all: leaves } : { any: leaves }

    const then: Rule['then'] = {}
    if (reason.trim()) then.reason = reason.trim()
    if (type === 'eligibility') then.decision = 'REJECT'
    if (type === 'scoring') {
      if (points.trim() === '' || Number.isNaN(Number(points))) return setProblem('Enter the points this rule adds or takes away.')
      then.points = Number(points)
    }
    if (type === 'pricing') {
      if (rate.trim() !== '') then.rate = Number(rate)
      if (fee.trim() !== '') then.fee = toPaise(Number(fee))
      if (advance.trim() !== '') then.advancePercent = Number(advance)
      if (Object.values(then).filter((v) => typeof v === 'number').length === 0) return setProblem('A pricing rule needs a rate, fee or advance.')
      if ([then.rate, then.fee, then.advancePercent].some((v) => v !== undefined && Number.isNaN(v))) return setProblem('Rate, fee and advance must be numbers.')
    }
    setProblem('')
    onSave({ id: ruleId, type, when, then })
  }

  return (
    <FormCard
      title={initial ? `Edit ${initial.id}` : 'Add a rule'}
      onSubmit={submit}
      buttons={
        <>
          <Button type="submit">{initial ? 'Update rule' : 'Add rule'}</Button>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        </>
      }
    >
      {problem && <Notice kind="danger">{problem}</Notice>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Rule id" value={id} onChange={(e) => setId(e.target.value)} placeholder="R-NEW-RULE" />
        <SelectField label="Type" value={type} onChange={(e) => setType(e.target.value as Rule['type'])}>
          {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </SelectField>
      </div>

      <fieldset className="m-0 grid gap-3 rounded-[12px] border border-line p-3">
        <legend className="px-1 text-sm font-semibold">When</legend>
        {rows.length > 1 || mode !== 'single' ? (
          <SelectField label="Match" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            <option value="all">All of these conditions</option>
            <option value="any">Any of these conditions</option>
          </SelectField>
        ) : null}
        {rows.map((r, i) => {
          const kind = kindOf(r.fact)
          return (
            <div key={i} className="grid items-end gap-3 sm:grid-cols-[1.3fr_1fr_1.2fr_auto]">
              <SelectField label="Fact" value={r.fact} onChange={(e) => changeFact(i, e.target.value)}>
                {facts.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </SelectField>
              <SelectField label="Condition" value={r.op} onChange={(e) => setRow(i, { op: e.target.value as Op })}>
                {opsFor(kind).map((o) => <option key={o} value={o}>{OP_LABEL[o]}</option>)}
              </SelectField>
              {kind === 'boolean' ? (
                <SelectField label="Value" value={r.text || 'true'} onChange={(e) => setRow(i, { text: e.target.value })}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </SelectField>
              ) : (
                <Field
                  label="Value"
                  value={r.text}
                  onChange={(e) => setRow(i, { text: e.target.value })}
                  hint={r.op === 'between' ? 'Low and high, like 6 and 12' : r.op === 'in' ? 'Separate with commas' : undefined}
                />
              )}
              {rows.length > 1 && <Button variant="row" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} aria-label={`Remove condition ${i + 1}`}>Remove</Button>}
            </div>
          )
        })}
        <div>
          <Button
            variant="row"
            onClick={() => {
              setRows((rs) => [...rs, { fact: facts[0].key, op: opsFor(facts[0].kind)[0], text: '' }])
              if (mode === 'single') setMode('all')
            }}
          >
            Add condition
          </Button>
        </div>
      </fieldset>

      <fieldset className="m-0 grid gap-3 rounded-[12px] border border-line p-3">
        <legend className="px-1 text-sm font-semibold">Then</legend>
        {type === 'eligibility' && <p className="m-0 text-sm text-muted">The invoice is rejected.</p>}
        {type === 'scoring' && <Field label="Points" type="number" value={points} onChange={(e) => setPoints(e.target.value)} hint="Use a negative number to take points away" />}
        {type === 'pricing' && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Rate change (% a year)" type="number" step="any" value={rate} onChange={(e) => setRate(e.target.value)} />
            <Field label="Fixed fee (₹)" type="number" step="any" value={fee} onChange={(e) => setFee(e.target.value)} />
            <Field label="Advance (%)" type="number" step="any" value={advance} onChange={(e) => setAdvance(e.target.value)} />
          </div>
        )}
        <Field label="Reason shown in the trace (optional)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="HIGH_CONCENTRATION" />
      </fieldset>
    </FormCard>
  )
}
