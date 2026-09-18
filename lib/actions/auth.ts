'use server'

import bcrypt from 'bcryptjs'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { recordAuditLog } from '@/lib/audit-log'
import { createSessionToken, getSession, setSessionCookie, type Role } from '@/lib/auth'
import { isBootstrapAdminUsername } from '@/lib/bootstrap-admin'
import { clearLoginFailures, getLoginThrottleStatus, registerFailedLogin } from '@/lib/login-throttle'
import { sendVerificationCodeEmail } from '@/lib/mail'
import { generateVerificationCode, hashVerificationCode, VERIFICATION_CODE_DURATION_MS } from '@/lib/password'
import { prisma } from '@/lib/prisma'

const MIN_PASSWORD_LENGTH = 6

type UsuarioParaSessao = {
  id: number
  username: string
  role: Role
  secretariaId: number | null
}

// Aplica a senha nova, limpa o código pendente e devolve a pessoa logada com uma
// sessão sem exigência de troca — usado tanto pelo fluxo "senha padrão" quanto
// pelo "esqueci minha senha".
async function finalizePasswordChange(usuario: UsuarioParaSessao, novaSenha: string) {
  const passwordHash = await bcrypt.hash(novaSenha, 12)

  await prisma.user.update({
    where: { id: usuario.id },
    data: {
      passwordHash,
      mustChangePassword: false,
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  })

  await recordAuditLog({
    actorUserId: usuario.id,
    action: 'user.password_self_change',
    entityType: 'user',
    entityId: usuario.id,
    targetUserId: usuario.id,
  })

  let projetoIds: number[] = []
  if (usuario.role === 'projeto_admin') {
    const links = await prisma.projetoResponsavel.findMany({
      where: { userId: usuario.id },
      select: { projetoId: true },
    })
    projetoIds = links.map((link) => link.projetoId)
  }

  const token = await createSessionToken({
    userId: usuario.id,
    username: usuario.username,
    role: usuario.role,
    secretariaId: usuario.secretariaId,
    projetoIds,
    mustChangePassword: false,
  })
  await setSessionCookie(token)

  revalidatePath('/admin')

  return { role: usuario.role }
}

async function requireMustChangePasswordSession() {
  const session = await getSession()
  if (!session) {
    throw new Error('Sessão expirada. Faça login novamente.')
  }
  if (!session.mustChangePassword) {
    throw new Error('Sua senha já foi definida.')
  }
  return session
}

export async function reenviarCodigoVerificacao() {
  const session = await requireMustChangePasswordSession()

  const usuario = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  })
  if (!usuario?.email) {
    throw new Error('Sua conta não tem e-mail cadastrado. Contate um administrador.')
  }

  const { code, codeHash } = generateVerificationCode()
  await prisma.user.update({
    where: { id: session.userId },
    data: {
      passwordResetToken: codeHash,
      passwordResetExpires: new Date(Date.now() + VERIFICATION_CODE_DURATION_MS),
    },
  })

  await sendVerificationCodeEmail(usuario.email, code)

  return { ok: true }
}

export async function definirNovaSenha(codigo: string, novaSenha: string) {
  const session = await requireMustChangePasswordSession()

  const senha = novaSenha.trim()
  if (senha.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`)
  }

  const codigoDigitado = codigo.trim()
  if (!codigoDigitado) {
    throw new Error('Digite o código de confirmação recebido por e-mail.')
  }

  const usuario = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { passwordResetToken: true, passwordResetExpires: true },
  })

  if (!usuario?.passwordResetToken || !usuario.passwordResetExpires || usuario.passwordResetExpires < new Date()) {
    throw new Error('Código expirado. Peça um novo código.')
  }

  if (hashVerificationCode(codigoDigitado) !== usuario.passwordResetToken) {
    throw new Error('Código incorreto. Confira o número recebido por e-mail.')
  }

  return finalizePasswordChange(
    { id: session.userId, username: session.username, role: session.role, secretariaId: session.secretariaId },
    senha,
  )
}

// --- "Esqueci minha senha" (sem sessão ativa) ---

async function getClientIdentifier() {
  const headersList = await headers()
  const forwardedFor = headersList.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwardedFor || headersList.get('x-real-ip')?.trim() || 'unknown'
}

// Usa o mesmo mecanismo de bloqueio temporário do login, mas num "namespace" próprio,
// pra não misturar tentativas de recuperação de senha com tentativas de login.
function throttleKeyPara(usernameOuEmail: string) {
  return `reset:${usernameOuEmail.trim().toLowerCase()}`
}

async function findUsuarioParaRecuperacao(usernameOuEmail: string) {
  const valor = usernameOuEmail.trim()
  if (!valor || isBootstrapAdminUsername(valor)) return null

  return prisma.user.findFirst({
    where: { OR: [{ username: valor }, { email: valor }] },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      secretariaId: true,
      passwordResetToken: true,
      passwordResetExpires: true,
    },
  })
}

// Sempre responde com sucesso — nunca revela se o usuário/e-mail existe de fato.
export async function solicitarRecuperacaoSenha(usernameOuEmail: string) {
  const valor = usernameOuEmail.trim()
  if (!valor) {
    throw new Error('Informe seu usuário ou e-mail.')
  }

  const clientIdentifier = await getClientIdentifier()
  const throttleKey = throttleKeyPara(valor)
  const throttleStatus = await getLoginThrottleStatus(throttleKey, clientIdentifier)
  if (throttleStatus.blocked) {
    throw new Error('Muitas tentativas. Aguarde alguns minutos e tente novamente.')
  }
  await registerFailedLogin(throttleKey, clientIdentifier)

  const usuario = await findUsuarioParaRecuperacao(valor)
  if (usuario?.email) {
    const { code, codeHash } = generateVerificationCode()
    await prisma.user.update({
      where: { id: usuario.id },
      data: {
        passwordResetToken: codeHash,
        passwordResetExpires: new Date(Date.now() + VERIFICATION_CODE_DURATION_MS),
      },
    })

    try {
      await sendVerificationCodeEmail(usuario.email, code)
    } catch (err) {
      console.error('Falha ao enviar e-mail de recuperação de senha:', err)
    }
  }

  return { ok: true }
}

export async function redefinirSenhaComCodigo(usernameOuEmail: string, codigo: string, novaSenha: string) {
  const valor = usernameOuEmail.trim()
  if (!valor) {
    throw new Error('Informe seu usuário ou e-mail.')
  }

  const senha = novaSenha.trim()
  if (senha.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`)
  }

  const codigoDigitado = codigo.trim()
  if (!codigoDigitado) {
    throw new Error('Digite o código de confirmação recebido por e-mail.')
  }

  const clientIdentifier = await getClientIdentifier()
  const throttleKey = throttleKeyPara(valor)
  const throttleStatus = await getLoginThrottleStatus(throttleKey, clientIdentifier)
  if (throttleStatus.blocked) {
    throw new Error('Muitas tentativas. Aguarde alguns minutos e tente novamente.')
  }

  const usuario = await findUsuarioParaRecuperacao(valor)
  const codigoValido =
    usuario?.passwordResetToken &&
    usuario.passwordResetExpires &&
    usuario.passwordResetExpires > new Date() &&
    hashVerificationCode(codigoDigitado) === usuario.passwordResetToken

  if (!usuario || !codigoValido) {
    await registerFailedLogin(throttleKey, clientIdentifier)
    throw new Error('Código incorreto ou expirado.')
  }

  await clearLoginFailures(throttleKey, clientIdentifier)

  return finalizePasswordChange(
    { id: usuario.id, username: usuario.username, role: usuario.role as Role, secretariaId: usuario.secretariaId },
    senha,
  )
}
