import { NextResponse } from 'next/server'
import { recordAuditLog } from '@/lib/audit-log'
import { clearSessionCookie, getSession } from '@/lib/auth'

export async function POST() {
  const session = await getSession()

  if (session) {
    await recordAuditLog({
      actorUserId: session.userId,
      action: 'auth.logout',
      entityType: 'auth',
      entityId: session.userId,
      details: { username: session.username, role: session.role },
    })
  }

  await clearSessionCookie()
  return NextResponse.json({ ok: true })
}
