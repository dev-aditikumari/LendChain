import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Button from '../components/Button'
import { Field } from '../components/Field'
import Logo from '../components/Logo'
import { ROLE_PREVIEW } from '../data/sample'
import { HOME, INTERNAL_ROLES, ROLES, ROLE_LABEL } from '../lib/permissions'

const STATS = [
  { value: '₹84 Cr', label: 'financed this year' },
  { value: '3.2 days', label: 'average to disburse' },
  { value: '0.4%', label: 'overdue rate' },
]

export default function Login() {
  const { user, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={HOME[user.role]} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await signIn({ email, password, code })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section
        className="relative flex flex-col justify-between gap-10 overflow-hidden p-8 text-white sm:p-12"
        style={{
          background:
            'radial-gradient(circle at 100% 0%, rgba(255,201,77,.32), transparent 40%), radial-gradient(circle at 0% 100%, rgba(56,189,248,.28), transparent 42%), linear-gradient(160deg, #2D1B7A 0%, #1C1250 58%, #0F2B66 100%)',
        }}
      >
        <Logo size={44} />
        <div>
          <h1 className="max-w-[460px] text-[40px] leading-[1.1] sm:text-[48px]">Invoices funded in days, not months.</h1>
          <p className="mt-4 max-w-[440px] text-[17px] text-white/90">
            Suppliers get paid early against confirmed invoices. Buyers keep their payment terms.
          </p>
          <div className="mt-8 grid max-w-[520px] grid-cols-3 gap-3">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-2xl border border-white/20 bg-white/10 p-3.5 backdrop-blur">
                <p className="font-display m-0 text-[22px] font-extrabold">{s.value}</p>
                <p className="m-0 text-xs text-white/85">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="m-0 mb-2 text-sm text-white/85">Try a role (fills the email):</p>
          <div className="flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setEmail(ROLE_PREVIEW[r])}
                className="min-h-11 cursor-pointer rounded-full border border-white/30 bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/20"
              >
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid place-items-center bg-[#FBF7FF]/70 p-6 sm:p-12">
        <form onSubmit={submit} className="grid w-full max-w-[400px] gap-4" noValidate>
          <div>
            <h2 className="text-[30px]">Welcome back</h2>
            <p className="m-0 mt-1 text-muted">Sign in to your LendChain workspace.</p>
          </div>
          <Field label="Email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Field label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <Field
            label="2-step code"
            inputMode="numeric"
            maxLength={6}
            autoComplete="one-time-code"
            hint={`Required for internal roles (${INTERNAL_ROLES.map((r) => ROLE_LABEL[r]).join(', ')}).`}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          {error && <p role="alert" className="m-0 rounded-[10px] bg-[#FDE2E2] px-3 py-2 text-sm font-semibold text-[#8A1C1C]">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</Button>
          <p className="m-0 text-xs text-muted">Demo password is Demo@1234 and the demo code is 123456.</p>
        </form>
      </section>
    </div>
  )
}
