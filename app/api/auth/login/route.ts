import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import { createSessionToken, setSessionCookie } from '@/lib/auth'
import { isBootstrapAdminUsername, verifyBootstrapAdminPassword } from '@/lib/bootstrap-admin'
import { clearLoginFailures, getLoginClientIdentifier, getLoginThrottleStatus, registerFailedLogin } from '@/lib/login-throttle'
import { sendVerificationCodeEmail } from '@/lib/mail'
import { generateVerificationCode, VERIFICATION_CODE_DURATION_MS } from '@/lib/password'
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

  const user = await prisma.user.findFirst({
    where: { OR: [{ username }, { email: username }] },
    select: {
      id: true,
      username: true,
      email: true,
      passwordHash: true,
      role: true,
      secretariaId: true,
      mustChangePassword: true,
      canEdit: true,
    },
  })

  const passwordMatches = isBootstrapAdminUsername(username)
    ? verifyBootstrapAdminPassword(password)
    : await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH)

  if (!user || !passwordMatches) {
    await registerFailedLogin(username, clientIdentifier)
    return NextResponse.json({ error: 'Usuário ou senha inválidos.' }, { status: 401 })
  }

  await clearLoginFailures(username, clientIdentifier)

  let projetoIds: number[] = []
  if (user.role === 'projeto_admin') {
    const links = await prisma.projetoResponsavel.findMany({
      where: { userId: user.id },
      select: { projetoId: true },
    })
    projetoIds = links.map((link) => link.projetoId)
  }

  const mustChangePassword = user.mustChangePassword ?? false

  if (mustChangePassword && user.email) {
    const { code, codeHash } = generateVerificationCode()
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: codeHash,
        passwordResetExpires: new Date(Date.now() + VERIFICATION_CODE_DURATION_MS),
      },
    })

    try {
      await sendVerificationCodeEmail(user.email, code)
    } catch (err) {
      console.error('Falha ao enviar e-mail de confirmação de senha:', err)
    }
  }

  const token = await createSessionToken({
    userId: user.id,
    username: user.username,
    role: user.role,
    secretariaId: user.secretariaId,
    projetoIds,
    mustChangePassword,
    canEdit: user.canEdit,
  })
  await setSessionCookie(token)

  return NextResponse.json({ ok: true, role: user.role, mustChangePassword })
}
