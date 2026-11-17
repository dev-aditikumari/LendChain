import type { Condition, FactDef, Op, Rule } from '../api/types'

export const OP_LABEL: Record<Op, string> = {
  eq: 'is',
  gt: 'is more than',
  lt: 'is less than',
  between: 'is between',
  in: 'is one of',
  regex: 'matches pattern',
}

export const TYPE_LABEL: Record<Rule['type'], string> = {
  eligibility: 'Eligibility',
  scoring: 'Scoring',
  pricing: 'Pricing',
}

// ops that make sense for a fact of this kind
export function opsFor(kind: FactDef['kind']): Op[] {
  if (kind === 'number') return ['gt', 'lt', 'between', 'eq', 'in']
  if (kind === 'boolean') return ['eq']
  return ['eq', 'in', 'regex']
}

export const isLeaf = (c: Condition): c is { fact: string; op: Op; value: unknown } => 'fact' in c

// editor handles a single comparison or one flat all/any group; anything deeper is shown but not editable
export function isSimple(c: Condition): boolean {
  if (isLeaf(c)) return true
  const kids = 'all' in c ? c.all : c.any
  return kids.every(isLeaf)
}

function valueText(v: unknown): string {
  return Array.isArray(v) ? v.join(v.length === 2 && typeof v[0] === 'number' ? ' and ' : ', ') : String(v)
}

export function describeCondition(c: Condition, facts: FactDef[]): string {
  if (isLeaf(c)) {
    const label = facts.find((f) => f.key === c.fact)?.label ?? c.fact
    return `${label} ${OP_LABEL[c.op]} ${valueText(c.value)}`
  }
  const kids = 'all' in c ? c.all : c.any
  const join = 'all' in c ? ' and ' : ' or '
  return kids.map((k) => (isLeaf(k) ? describeCondition(k, facts) : `(${describeCondition(k, facts)})`)).join(join)
}

export function describeOutcome(r: Rule): string {
  const t = r.then
  if (r.type === 'eligibility') return `Reject${t.reason ? ` (${t.reason})` : ''}`
  if (r.type === 'scoring') return `${(t.points ?? 0) > 0 ? '+' : ''}${t.points ?? 0} points`
  const parts: string[] = []
  if (t.rate !== undefined) parts.push(`rate ${t.rate > 0 ? '+' : ''}${t.rate}%`)
  if (t.fee !== undefined) parts.push(`fee ${t.fee / 100}`)
  if (t.advancePercent !== undefined) parts.push(`advance ${t.advancePercent}%`)
  return parts.join(', ')
}

// text typed in the form -> value the server expects; null when it cannot be read
export function parseValue(op: Op, kind: FactDef['kind'], text: string): unknown | null {
  const t = text.trim()
  if (t === '') return null
  const num = (s: string) => (s.trim() === '' || Number.isNaN(Number(s)) ? NaN : Number(s))
  if (kind === 'boolean') return t === 'true'
  if (op === 'between') {
    const parts = t.split(/\s*(?:,|and|-)\s*/).map(num)
    return parts.length === 2 && parts.every((n) => !Number.isNaN(n)) ? parts : null
  }
  if (op === 'in') {
    const parts = t.split(',').map((s) => s.trim()).filter(Boolean)
    if (kind === 'number') {
      const nums = parts.map(num)
      return nums.every((n) => !Number.isNaN(n)) ? nums : null
    }
    return parts
  }
  if (kind === 'number') {
    const n = num(t)
    return Number.isNaN(n) ? null : n
  }
  return t
}

export function valueToText(v: unknown): string {
  if (Array.isArray(v)) return v.join(', ')
  return v === undefined ? '' : String(v)
}
