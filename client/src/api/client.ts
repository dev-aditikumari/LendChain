import { DEMO_USERS, type DemoUser } from '../data/sample'
import { INTERNAL_ROLES } from '../lib/permissions'

const DEMO_PASSWORD = 'Demo@1234'
const DEMO_CODE = '123456'

export class ApiError extends Error {}

const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms))

export interface LoginInput {
  email: string
  password: string
  code?: string
}

// stands in for POST /auth/login until the server exists
export async function login({ email, password, code }: LoginInput): Promise<DemoUser> {
  await wait()
  const user = DEMO_USERS.find((u) => u.email === email.trim().toLowerCase())
  if (!user || password !== DEMO_PASSWORD) throw new ApiError('Email or password is incorrect.')
  if (INTERNAL_ROLES.includes(user.role) && code !== DEMO_CODE) {
    throw new ApiError('Enter the 6-digit code (demo code is 123456).')
  }
  return user
}
