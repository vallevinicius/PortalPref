import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import { createSessionToken, setSessionCookie } from '@/lib/auth'
import { clearLoginFailures, getLoginClientIdentifier, getLoginThrottleStatus, registerFailedLogin } from '@/lib/login-throttle'
import { prisma } from '@/lib/prisma'

// Hash fixo usado quando o usuário não existe, para que o tempo de resposta
// não revele (por timing) se um nome de usuário é válido ou não.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('nenhum-usuario-com-este-nome-existe', 12)

export async function POST(request: Request) {
  const { username, password } = await request.json()

  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return NextResponse.json({ error: 'Usuário e senha são obrigatórios.' }, { status: 400 })
  }

  const clientIdentifier = getLoginClientIdentifier(request)
  const throttleStatus = await getLoginThrottleStatus(username, clientIdentifier)
  if (throttleStatus.blocked) {
    return NextResponse.json(
      { error: 'Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.' },
      { status: 429, headers: { 'Retry-After': String(throttleStatus.retryAfterSeconds) } },
    )
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

  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH)

  if (!user || !passwordMatches) {
    await registerFailedLogin(username, clientIdentifier)
    return NextResponse.json({ error: 'Usuário ou senha inválidos.' }, { status: 401 })
  }

  await clearLoginFailures(username, clientIdentifier)

  const token = await createSessionToken({
    userId: user.id,
    username: user.username,
    role: user.role,
    secretariaId: user.secretariaId,
  })
  await setSessionCookie(token)

  return NextResponse.json({ ok: true, role: user.role })
}
