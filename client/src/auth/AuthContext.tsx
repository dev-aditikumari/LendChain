import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { login as apiLogin, type LoginInput } from '../api/client'
import type { DemoUser } from '../data/sample'
import { actionLevel, sectionLevel, type Level } from '../lib/permissions'

interface AuthValue {
  user: DemoUser | null
  signIn: (input: LoginInput) => Promise<void>
  signOut: () => void
  action: (name: string) => Level
  section: (name: string) => Level
}

const AuthContext = createContext<AuthValue | null>(null)
const KEY = 'lendchain.user'

function load(): DemoUser | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as DemoUser) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(load)

  const signIn = useCallback(async (input: LoginInput) => {
    const u = await apiLogin(input)
    try { sessionStorage.setItem(KEY, JSON.stringify(u)) } catch { /* storage unavailable */ }
    setUser(u)
  }, [])

  const signOut = useCallback(() => {
    try { sessionStorage.removeItem(KEY) } catch { /* storage unavailable */ }
    setUser(null)
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      user,
      signIn,
      signOut,
      action: (name) => (user ? actionLevel(user.role, name) : 'none'),
      section: (name) => (user ? sectionLevel(user.role, name) : 'none'),
    }),
    [user, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
