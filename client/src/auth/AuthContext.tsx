import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { http, setUnauthorizedHandler, tokenStore } from '../api/http'
import { sectionLevel } from '../lib/access'
import type { Level, Role } from '../lib/permissions'
import { ROLE_KEY, type ServerRole } from '../lib/serverRoles'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: Role
  entityId?: string
  permissions: string[]
}

interface ApiUser {
  _id?: string
  id?: string
  name: string
  email: string
  role: ServerRole
  entityId?: string
}

interface AuthValue {
  user: AuthUser | null
  ready: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
  can: (permission: string) => boolean
  section: (name: string) => Level
}

const AuthContext = createContext<AuthValue | null>(null)

function toUser(u: ApiUser, permissions: string[]): AuthUser {
  const role = ROLE_KEY[u.role]
  if (!role) throw new Error(`Unknown role ${u.role}`)
  return { id: String(u._id ?? u.id), name: u.name, email: u.email, role, entityId: u.entityId, permissions }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(() => tokenStore.get() === null)

  const drop = useCallback(() => {
    tokenStore.clear()
    setUser(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(drop)
    if (tokenStore.get() === null) return
    // restore the session and permissions after a reload
    http<ApiUser & { permissions: string[] }>('/auth/me')
      .then((me) => setUser(toUser(me, me.permissions)))
      .catch(drop)
      .finally(() => setReady(true))
  }, [drop])

  const signIn = useCallback(async (email: string, password: string) => {
    const r = await http<{ token: string; user: ApiUser; permissions: string[] }>('/auth/login', {
      body: { email, password },
    })
    tokenStore.set(r.token)
    setUser(toUser(r.user, r.permissions))
  }, [])

  const signOut = useCallback(() => {
    http('/auth/logout', { method: 'POST', body: {} }).catch(() => {})
    drop()
  }, [drop])

  const value = useMemo<AuthValue>(
    () => ({
      user,
      ready,
      signIn,
      signOut,
      can: (permission) => !!user?.permissions.includes(permission),
      section: (name) => (user ? sectionLevel(user.permissions, name) : 'none'),
    }),
    [user, ready, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
