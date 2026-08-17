import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import { createSessionToken, setSessionCookie } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  const { username, password } = await request.json()

  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return NextResponse.json({ error: 'Usuário e senha são obrigatórios.' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      passwordHash: true,
      role: true,
      secretariaId: true,
    },
  })

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json({ error: 'Usuário ou senha inválidos.' }, { status: 401 })
  }

  const token = await createSessionToken({
    userId: user.id,
    username: user.username,
    role: user.role,
    secretariaId: user.secretariaId,
  })
  await setSessionCookie(token)

  return NextResponse.json({ ok: true, role: user.role })
}
