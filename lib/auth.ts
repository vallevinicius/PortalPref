import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

export const SESSION_COOKIE = 'session'
const SESSION_DURATION_SECONDS = 60 * 60 * 8 // 8 horas

export type Role = 'super_admin' | 'secretaria_admin'

export type SessionPayload = {
  userId: number
  username: string
  role: Role
  secretariaId: number | null
}

function getSecretKey() {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    throw new Error('SESSION_SECRET não está definido no .env')
  }
  return new TextEncoder().encode(secret)
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey())
}

export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSecretKey())
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_SECONDS,
  })
}

export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null
  return verifySessionToken(token)
}

export class UnauthorizedError extends Error {}

export async function requireSession(...allowedRoles: Role[]) {
  const session = await getSession()
  if (!session || (allowedRoles.length > 0 && !allowedRoles.includes(session.role))) {
    throw new UnauthorizedError('Acesso não autorizado.')
  }
  return session
}
