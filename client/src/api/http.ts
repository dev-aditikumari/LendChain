// The one place that knows the API address and how the token is kept.
// Set VITE_API_URL to call the API directly instead of through the dev proxy.
const BASE: string = import.meta.env.VITE_API_URL ?? '/api'
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

export function messageFor(err: unknown): string {
  if (err instanceof ApiError && err.status === 403) return 'You are not allowed to do that.'
  return err instanceof Error ? err.message : 'Something went wrong.'
}
