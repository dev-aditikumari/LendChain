// The one place that knows the API address and how the token is kept.
// Set VITE_API_URL (for example https://api.example.com) to call the API directly; without it the dev server proxies /api.
const configured = String(import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '')
export const BASE: string = configured || '/api'
const TOKEN_KEY = 'lendchain.token'

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message)
  }
}

export const tokenStore = {
  get(): string | null {
    try { return sessionStorage.getItem(TOKEN_KEY) } catch { return null }
  },
  set(token: string) {
    try { sessionStorage.setItem(TOKEN_KEY, token) } catch { /* storage unavailable */ }
  },
  clear() {
    try { sessionStorage.removeItem(TOKEN_KEY) } catch { /* storage unavailable */ }
  },
}

let onUnauthorized: () => void = () => {}
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn
}

interface Options {
  method?: string
  body?: unknown
  headers?: Record<string, string>
}

export async function http<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const token = tokenStore.get()
  let res: Response
  try {
    res = await fetch(BASE + path, {
      method: opts.method ?? (opts.body ? 'POST' : 'GET'),
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...opts.headers,
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check that the API is running.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    // a bad password on the login form is not an expired session
    if (res.status === 401 && token) onUnauthorized()
    const issues = Array.isArray(data.issues)
      ? data.issues.map((i: { path: (string | number)[]; message: string }) => `${i.path.join('.')}: ${i.message}`).join(', ')
      : ''
    throw new ApiError(res.status, issues || data.error || 'Request failed', data.code)
  }
  return data as T
}

// the server sends a short code with each refusal; these say what it means for the person using the screen
const CODE_MESSAGE: Record<string, string> = {
  ROLE_NOT_ALLOWED: 'Your role is not allowed to do this.',
  NOT_YOUR_INVOICE: 'This invoice does not belong to you.',
  MAKER_CHECKER: 'You created, recommended or requested this, so someone else has to decide it.',
  ABOVE_APPROVAL_LIMIT: 'This amount is above your approval limit and has to be escalated.',
  SEGREGATION_OF_DUTIES: 'You approved this invoice, so you cannot also move its money.',
  DUAL_CONTROL: 'You queued this payout, so a different person has to authorise it.',
  ALREADY_AUTHORISED: 'Someone else already released this payout.',
  IDEMPOTENCY_KEY_REUSED: 'That request was already used for something else. Try again.',
  LIMIT_EXCEEDED: 'The program limit would be exceeded, so the invoice was rejected.',
  DUPLICATE_INVOICE: 'An invoice with this number, amount and date already exists for this buyer.',
  NO_PROGRAM: 'There is no financing program between you and this buyer.',
  OVERPAYMENT: 'That is more than what is due.',
  NOT_A_DRAFT: 'Only a draft can be changed or published.',
  NOT_YOUR_DRAFT: 'This draft belongs to someone else.',
  VERSION_CONFLICT: 'Someone else changed this invoice. Reload and try again.',
}

export function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code && CODE_MESSAGE[err.code]) return CODE_MESSAGE[err.code]
    if (err.status === 403) return 'You are not allowed to do that.'
  }
  return err instanceof Error ? err.message : 'Something went wrong.'
}
