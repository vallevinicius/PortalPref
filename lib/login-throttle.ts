import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'

export const LOGIN_MAX_FAILURES = 5
export const LOGIN_WINDOW_MS = 15 * 60 * 1000
export const LOGIN_BLOCK_MS = 15 * 60 * 1000
export const LOGIN_RETENTION_MS = 24 * 60 * 60 * 1000

export type LoginThrottleStatus = {
  blocked: boolean
  retryAfterSeconds: number
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase().slice(0, 255)
}

function hashKey(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function getThrottleKeys(username: string, clientIdentifier: string) {
  const normalizedUsername = normalizeUsername(username)
  const normalizedClient = clientIdentifier.trim().slice(0, 255) || 'unknown'

  const keys = [hashKey(`username:${normalizedUsername}`)]
  if (normalizedClient !== 'unknown') keys.push(hashKey(`client:${normalizedClient}`))
  return keys
}

export function getLoginClientIdentifier(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwardedFor || request.headers.get('x-real-ip')?.trim() || 'unknown'
}

export async function getLoginThrottleStatus(username: string, clientIdentifier: string): Promise<LoginThrottleStatus> {
  const now = Date.now()
  const rows = await prisma.loginThrottle.findMany({
    where: { key: { in: getThrottleKeys(username, clientIdentifier) } },
    select: { blockedUntil: true },
  })

  const activeBlocks = rows
    .map((row) => row.blockedUntil?.getTime() ?? 0)
    .filter((blockedUntil) => blockedUntil > now)

  if (activeBlocks.length === 0) return { blocked: false, retryAfterSeconds: 0 }

  const latestBlock = Math.max(...activeBlocks)
  return {
    blocked: true,
    retryAfterSeconds: Math.max(1, Math.ceil((latestBlock - now) / 1000)),
  }
}

export async function registerFailedLogin(username: string, clientIdentifier: string) {
  const now = new Date()
  const keys = getThrottleKeys(username, clientIdentifier)

  for (const key of keys) {
    const current = await prisma.loginThrottle.findUnique({ where: { key } })
    const windowExpired = !current || now.getTime() - current.windowStartedAt.getTime() >= LOGIN_WINDOW_MS
    const nextFailures = windowExpired ? 1 : current.failedAttempts + 1
    const blockedUntil = nextFailures >= LOGIN_MAX_FAILURES ? new Date(now.getTime() + LOGIN_BLOCK_MS) : null
    const windowStartedAt = windowExpired ? now : current?.windowStartedAt ?? now

    await prisma.loginThrottle.upsert({
      where: { key },
      update: {
        failedAttempts: nextFailures,
        windowStartedAt,
        blockedUntil,
      },
      create: {
        key,
        failedAttempts: nextFailures,
        windowStartedAt: now,
        blockedUntil,
      },
    })
  }

  await prisma.loginThrottle.deleteMany({
    where: { updatedAt: { lt: new Date(now.getTime() - LOGIN_RETENTION_MS) } },
  })
}

export async function clearLoginFailures(username: string, clientIdentifier: string) {
  await prisma.loginThrottle.deleteMany({
    where: { key: { in: getThrottleKeys(username, clientIdentifier) } },
  })
}
