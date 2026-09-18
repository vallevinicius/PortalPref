'use server'

import bcrypt from 'bcryptjs'
import { UserRole } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { recordAuditLog } from '@/lib/audit-log'
import { assertCanEdit, requireSession, UnauthorizedError, type SessionPayload } from '@/lib/auth'
import { isBootstrapAdminUsername } from '@/lib/bootstrap-admin'
import { sendVerificationCodeEmail } from '@/lib/mail'
import { DEFAULT_PASSWORD, generateRandomPassword, generateVerificationCode, VERIFICATION_CODE_DURATION_MS } from '@/lib/password'
import { prisma } from '@/lib/prisma'

async function assertProjetoOwnership(projetoId: number, session: SessionPayload) {
  const projeto = await prisma.projeto.findUnique({
    where: { id: projetoId },
    select: { id: true, secretariaId: true },
  })

  if (!projeto) {
    throw new UnauthorizedError('Projeto não encontrado.')
  }

  if (session.role === 'super_admin') {
    return projeto
  }

  if (session.role === 'secretaria_admin' && session.secretariaId === projeto.secretariaId) {
    return projeto
  }

  throw new UnauthorizedError('Você não tem permissão para gerenciar o usuário deste projeto.')
}

function duplicateFieldError(err: unknown): Error | null {
  if ((err as { code?: string }).code !== 'P2002') return null
  const target = (err as { meta?: { target?: string[] } }).meta?.target ?? []
  if (target.includes('email')) {
    return new Error('Já existe um usuário com esse e-mail.')
  }
  return new Error('Já existe um usuário com esse nome de acesso.')
}

export async function createSecretariaUser(username: string, email: string, secretariaId: number) {
  const session = await requireSession('super_admin')
  assertCanEdit(session)

  const trimmed = username.trim()
  if (!trimmed) {
    throw new Error('Informe o nome de usuário de acesso da secretaria.')
  }
  const trimmedEmail = email.trim()
  if (!trimmedEmail) {
    throw new Error('Informe o e-mail de acesso da secretaria.')
  }

  const password = DEFAULT_PASSWORD
  const passwordHash = await bcrypt.hash(password, 12)

  let createdUser: { id: number } | undefined
  try {
    createdUser = await prisma.user.create({
      data: {
        username: trimmed,
        email: trimmedEmail,
        passwordHash,
        mustChangePassword: true,
        role: UserRole.secretaria_admin,
        secretariaId,
      },
    })
  } catch (err) {
    throw duplicateFieldError(err) ?? err
  }

  await recordAuditLog({
    actorUserId: session.userId,
    action: 'user.create',
    entityType: 'user',
    entityId: createdUser?.id,
    targetUserId: createdUser?.id,
    details: { role: UserRole.secretaria_admin, secretariaId },
  })

  revalidatePath('/admin')

  return { username: trimmed, password }
}

export async function createSuperAdmin(username: string, canEdit: boolean = true) {
  const session = await requireSession('super_admin')
  assertCanEdit(session)

  const trimmed = username.trim()
  if (!trimmed) {
    throw new Error('Informe o usuário de acesso.')
  }

  const password = generateRandomPassword()
  const passwordHash = await bcrypt.hash(password, 12)

  let createdUser: { id: number } | undefined
  try {
    createdUser = await prisma.user.create({
      data: {
        username: trimmed,
        passwordHash,
        role: UserRole.super_admin,
        secretariaId: null,
        canEdit,
      },
    })
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      throw new Error('Já existe um usuário com esse nome de acesso.')
    }
    throw err
  }

  await recordAuditLog({
    actorUserId: session.userId,
    action: 'user.create',
    entityType: 'user',
    entityId: createdUser?.id,
    targetUserId: createdUser?.id,
    details: { role: UserRole.super_admin, secretariaId: null, canEdit },
  })

  revalidatePath('/admin')

  return { username: trimmed, password }
}

export async function createProjetoUser(username: string, email: string, projetoId: number) {
  const session = await requireSession('super_admin', 'secretaria_admin')
  assertCanEdit(session)
  const projeto = await assertProjetoOwnership(projetoId, session)

  const trimmed = username.trim()
  if (!trimmed) {
    throw new Error('Informe o nome de usuário de acesso do responsável.')
  }
  const trimmedEmail = email.trim()
  if (!trimmedEmail) {
    throw new Error('Informe o e-mail de acesso do responsável.')
  }

  const password = DEFAULT_PASSWORD
  const passwordHash = await bcrypt.hash(password, 12)

  let createdUser: { id: number } | undefined
  try {
    createdUser = await prisma.user.create({
      data: {
        username: trimmed,
        email: trimmedEmail,
        passwordHash,
        mustChangePassword: true,
        role: UserRole.projeto_admin,
        projetosResponsavel: { create: { projetoId } },
      },
    })
  } catch (err) {
    throw duplicateFieldError(err) ?? err
  }

  await recordAuditLog({
    actorUserId: session.userId,
    action: 'user.create',
    entityType: 'user',
    entityId: createdUser?.id,
    targetUserId: createdUser?.id,
    details: { role: UserRole.projeto_admin, projetoId, secretariaId: projeto.secretariaId },
  })

  revalidatePath('/admin')
  revalidatePath(`/admin/secretarias/${projeto.secretariaId}`)
  revalidatePath(`/admin/projetos/${projetoId}`)

  return { username: trimmed, password }
}

export async function assignProjetoUser(userId: number, projetoId: number) {
  const session = await requireSession('super_admin', 'secretaria_admin')
  assertCanEdit(session)
  const projeto = await assertProjetoOwnership(projetoId, session)

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      role: true,
      projetosResponsavel: { select: { projeto: { select: { id: true, secretariaId: true } } } },
    },
  })

  if (!target || target.role !== UserRole.projeto_admin) {
    throw new Error('Usuário não encontrado ou não é uma conta de responsável de projeto.')
  }

  if (target.projetosResponsavel.some((link) => link.projeto.id === projetoId)) {
    throw new Error('Este usuário já é responsável por este projeto.')
  }

  if (target.projetosResponsavel.some((link) => link.projeto.secretariaId !== projeto.secretariaId)) {
    throw new UnauthorizedError('Este usuário já é responsável por projetos de outra secretaria.')
  }

  await prisma.projetoResponsavel.create({ data: { userId, projetoId } })

  await recordAuditLog({
    actorUserId: session.userId,
    action: 'user.assign',
    entityType: 'user',
    entityId: userId,
    targetUserId: userId,
    details: { projetoId, secretariaId: projeto.secretariaId },
  })

  revalidatePath('/admin')
  revalidatePath(`/admin/secretarias/${projeto.secretariaId}`)
  revalidatePath(`/admin/projetos/${projetoId}`)

  return { username: target.username }
}

export async function unassignProjetoUser(userId: number, projetoId: number) {
  const session = await requireSession('super_admin', 'secretaria_admin')
  assertCanEdit(session)
  const projeto = await assertProjetoOwnership(projetoId, session)

  const link = await prisma.projetoResponsavel.findUnique({
    where: { userId_projetoId: { userId, projetoId } },
  })

  if (!link) {
    throw new Error('Este usuário não é responsável por este projeto.')
  }

  await prisma.projetoResponsavel.delete({ where: { id: link.id } })

  await recordAuditLog({
    actorUserId: session.userId,
    action: 'user.unassign',
    entityType: 'user',
    entityId: userId,
    targetUserId: userId,
    details: { projetoId, secretariaId: projeto.secretariaId },
  })

  revalidatePath('/admin')
  revalidatePath(`/admin/secretarias/${projeto.secretariaId}`)
  revalidatePath(`/admin/projetos/${projetoId}`)
}

// Encontra o usuário-alvo e garante que quem está chamando pode gerenciá-lo:
// super_admin gerencia secretário e responsável de projeto de qualquer secretaria (e, com
// allowSuperAdminTarget, também outros admins supremos); secretaria_admin só gerencia
// responsáveis de projeto cujos projetos são todos da própria secretaria.
async function getManageableUser(userId: number, session: SessionPayload, options: { allowSuperAdminTarget?: boolean } = {}) {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      projetosResponsavel: { select: { projeto: { select: { secretariaId: true } } } },
    },
  })

  if (!target) {
    throw new Error('Usuário não encontrado.')
  }

  if (session.role === 'super_admin') {
    const allowedRoles: UserRole[] = [UserRole.secretaria_admin, UserRole.projeto_admin]
    if (options.allowSuperAdminTarget) allowedRoles.push(UserRole.super_admin)
    if (!allowedRoles.includes(target.role)) {
      throw new Error('Usuário não encontrado.')
    }
    return target
  }

  if (
    target.role !== UserRole.projeto_admin ||
    target.projetosResponsavel.length === 0 ||
    !target.projetosResponsavel.every((link) => link.projeto.secretariaId === session.secretariaId)
  ) {
    throw new UnauthorizedError('Você só pode gerenciar responsáveis de projetos da sua secretaria.')
  }

  return target
}

// Edita usuário/e-mail de um secretário ou responsável de projeto. Não mexe em senha —
// de propósito, para que quem gerencia usuários por aqui nunca precise ter acesso a ela.
export async function updateUserProfile(userId: number, username: string, email: string) {
  const session = await requireSession('super_admin', 'secretaria_admin')
  assertCanEdit(session)
  const target = await getManageableUser(userId, session)

  if (isBootstrapAdminUsername(target.username)) {
    throw new Error('Este usuário é definido pelo .env do servidor e não pode ser editado por aqui.')
  }

  const trimmedUsername = username.trim()
  if (!trimmedUsername) {
    throw new Error('Informe o nome de usuário.')
  }
  const trimmedEmail = email.trim()
  if (!trimmedEmail) {
    throw new Error('Informe o e-mail.')
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { username: trimmedUsername, email: trimmedEmail },
    })
  } catch (err) {
    throw duplicateFieldError(err) ?? err
  }

  await recordAuditLog({
    actorUserId: session.userId,
    action: 'user.update',
    entityType: 'user',
    entityId: userId,
    targetUserId: userId,
    details: { role: target.role },
  })

  revalidatePath('/admin')
  revalidatePath('/admin/usuarios')
}

// Exclui um secretário, responsável de projeto ou (só quando quem chama é admin supremo)
// outro admin supremo. Remove também os vínculos dele com projetos (projetoResponsavel),
// mas não mexe nos projetos, indicadores ou secretarias em si.
export async function deleteUser(userId: number) {
  const session = await requireSession('super_admin', 'secretaria_admin')
  assertCanEdit(session)
  const target = await getManageableUser(userId, session, { allowSuperAdminTarget: true })

  if (isBootstrapAdminUsername(target.username)) {
    throw new Error('Este usuário é definido pelo .env do servidor e não pode ser excluído por aqui.')
  }

  if (target.id === session.userId) {
    throw new Error('Você não pode excluir a sua própria conta.')
  }

  await prisma.user.delete({ where: { id: userId } })

  await recordAuditLog({
    actorUserId: session.userId,
    action: 'user.delete',
    entityType: 'user',
    details: { username: target.username, role: target.role },
  })

  revalidatePath('/admin')
  revalidatePath('/admin/usuarios')
}

// Não existe mais "ver senha" nem "gerar nova senha" por um administrador — por LGPD,
// ninguém além do próprio usuário deve saber a senha dele. O jeito de ajudar alguém que
// esqueceu a senha é mandar um e-mail com um código, igual ao "Esqueci minha senha" do
// login, só que iniciado por um administrador em nome da pessoa.
export async function enviarRedefinicaoSenha(userId: number) {
  const session = await requireSession('super_admin', 'secretaria_admin')
  assertCanEdit(session)
  const target = await getManageableUser(userId, session, { allowSuperAdminTarget: true })

  if (isBootstrapAdminUsername(target.username)) {
    throw new Error('Este usuário é definido pelo .env do servidor e não pode ter a senha redefinida por aqui.')
  }
  if (!target.email) {
    throw new Error('Este usuário não tem e-mail cadastrado. Atualize o e-mail antes de redefinir a senha.')
  }

  const { code, codeHash } = generateVerificationCode()
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordResetToken: codeHash,
      passwordResetExpires: new Date(Date.now() + VERIFICATION_CODE_DURATION_MS),
    },
  })

  await sendVerificationCodeEmail(target.email, code)

  await recordAuditLog({
    actorUserId: session.userId,
    action: 'user.password_reset_email',
    entityType: 'user',
    entityId: userId,
    targetUserId: userId,
    details: { role: target.role },
  })

  return { ok: true }
}
