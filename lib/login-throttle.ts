import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { getClientIpFromRequest } from '@/lib/request-ip'

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
  // "unknown" agora é um valor fixo (nunca controlado pelo cliente — ver getClientIpFromRequest),
  // então também vira um balde de contagem próprio, e não um escape do limite por origem.
  const normalizedClient = clientIdentifier.trim().slice(0, 255) || 'unknown'

  return [hashKey(`username:${normalizedUsername}`), hashKey(`client:${normalizedClient}`)]
}

// Usa só o IP gravado pelo proxy confiável (X-Real-IP/X-Forwarded-For já normalizados
// pela infraestrutura). Nunca confia em headers como o cliente os enviou: era assim que o
// limite por origem era contornado trocando o valor a cada requisição.
export function getLoginClientIdentifier(request: Request) {
  return getClientIpFromRequest(request) ?? 'unknown'
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
