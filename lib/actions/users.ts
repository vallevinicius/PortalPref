'use server'

import bcrypt from 'bcryptjs'
import { UserRole } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { recordAuditLog } from '@/lib/audit-log'
import { requireSession, UnauthorizedError, type SessionPayload } from '@/lib/auth'
import { isBootstrapAdminUsername, verifyBootstrapAdminPassword } from '@/lib/bootstrap-admin'
import { decryptSecret, encryptSecret } from '@/lib/crypto'
import { generateRandomPassword } from '@/lib/password'
import { prisma } from '@/lib/prisma'

async function verifyOwnPassword(userId: number, username: string, confirmPassword: string) {
  if (isBootstrapAdminUsername(username)) {
    if (!verifyBootstrapAdminPassword(confirmPassword)) {
      throw new Error('Senha incorreta.')
    }
    return
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  })

  if (!user || !(await bcrypt.compare(confirmPassword, user.passwordHash))) {
    throw new Error('Senha incorreta.')
  }
}

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

async function recordPasswordView(actorUserId: number, targetUserId: number) {
  await recordAuditLog({
    actorUserId,
    action: 'view_password',
    entityType: 'user',
    entityId: targetUserId,
    targetUserId,
  })
}

export async function createSecretariaUser(username: string, secretariaId: number) {
  const session = await requireSession('super_admin')

  const trimmed = username.trim()
  if (!trimmed) {
    throw new Error('Informe o usuário de acesso da secretaria.')
  }

  const password = generateRandomPassword()
  const passwordHash = await bcrypt.hash(password, 12)
  const passwordEncrypted = encryptSecret(password)

  let createdUser: { id: number } | undefined
  try {
    createdUser = await prisma.user.create({
      data: {
        username: trimmed,
        passwordHash,
        passwordEncrypted,
        role: UserRole.secretaria_admin,
        secretariaId,
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
    details: { role: UserRole.secretaria_admin, secretariaId },
  })

  revalidatePath('/admin')

  return { username: trimmed, password }
}

export async function resetSecretariaUserPassword(userId: number) {
  const session = await requireSession('super_admin')

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  })

  if (!target || target.role !== UserRole.secretaria_admin) {
    throw new Error('Usuário não encontrado ou não é uma conta de secretaria.')
  }

  const password = generateRandomPassword()
  const passwordHash = await bcrypt.hash(password, 12)
  const passwordEncrypted = encryptSecret(password)

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      passwordEncrypted,
    },
  })

  await recordAuditLog({
    actorUserId: session.userId,
    action: 'user.password_reset',
    entityType: 'user',
    entityId: userId,
    targetUserId: userId,
    details: { role: UserRole.secretaria_admin },
  })

  revalidatePath('/admin')

  return { password }
}

export async function getSecretariaUserPassword(userId: number, confirmPassword: string) {
  const session = await requireSession('super_admin')
  await verifyOwnPassword(session.userId, session.username, confirmPassword)

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, passwordEncrypted: true },
  })

  if (!target || target.role !== UserRole.secretaria_admin) {
    throw new Error('Usuário não encontrado ou não é uma conta de secretaria.')
  }

  if (!target.passwordEncrypted) {
    throw new Error('Esta senha foi definida antes deste recurso existir. Gere uma nova senha para poder visualizá-la.')
  }

  await recordPasswordView(session.userId, target.id)

  return { password: decryptSecret(target.passwordEncrypted) }
}

export async function createSuperAdmin(username: string) {
  const session = await requireSession('super_admin')

  const trimmed = username.trim()
  if (!trimmed) {
    throw new Error('Informe o usuário de acesso.')
  }

  const password = generateRandomPassword()
  const passwordHash = await bcrypt.hash(password, 12)
  const passwordEncrypted = encryptSecret(password)

  let createdUser: { id: number } | undefined
  try {
    createdUser = await prisma.user.create({
      data: {
        username: trimmed,
        passwordHash,
        passwordEncrypted,
        role: UserRole.super_admin,
        secretariaId: null,
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
    details: { role: UserRole.super_admin, secretariaId: null },
  })

  revalidatePath('/admin')

  return { username: trimmed, password }
}

export async function resetSuperAdminPassword(userId: number) {
  const session = await requireSession('super_admin')

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, username: true },
  })

  if (!target || target.role !== UserRole.super_admin) {
    throw new Error('Usuário não encontrado ou não é uma conta de administrador supremo.')
  }

  if (isBootstrapAdminUsername(target.username)) {
    throw new Error('A senha deste usuário é definida pelo arquivo .env do servidor e não pode ser alterada por aqui.')
  }

  const password = generateRandomPassword()
  const passwordHash = await bcrypt.hash(password, 12)
  const passwordEncrypted = encryptSecret(password)

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      passwordEncrypted,
    },
  })

  await recordAuditLog({
    actorUserId: session.userId,
    action: 'user.password_reset',
    entityType: 'user',
    entityId: userId,
    targetUserId: userId,
    details: { role: UserRole.super_admin },
  })

  revalidatePath('/admin')

  return { password }
}

export async function getSuperAdminPassword(userId: number, confirmPassword: string) {
  const session = await requireSession('super_admin')
  await verifyOwnPassword(session.userId, session.username, confirmPassword)

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, username: true, passwordEncrypted: true },
  })

  if (!target || target.role !== UserRole.super_admin) {
    throw new Error('Usuário não encontrado ou não é uma conta de administrador supremo.')
  }

  if (isBootstrapAdminUsername(target.username)) {
    throw new Error('A senha deste usuário é definida pelo arquivo .env do servidor e não pode ser vista por aqui.')
  }

  if (!target.passwordEncrypted) {
    throw new Error('Esta senha foi definida antes deste recurso existir. Gere uma nova senha para poder visualizá-la.')
  }

  await recordPasswordView(session.userId, target.id)

  return { password: decryptSecret(target.passwordEncrypted) }
}

export async function createProjetoUser(username: string, projetoId: number) {
  const session = await requireSession('super_admin', 'secretaria_admin')
  const projeto = await assertProjetoOwnership(projetoId, session)

  const trimmed = username.trim()
  if (!trimmed) {
    throw new Error('Informe o usuário de acesso do responsável.')
  }

  const password = generateRandomPassword()
  const passwordHash = await bcrypt.hash(password, 12)
  const passwordEncrypted = encryptSecret(password)

  let createdUser: { id: number } | undefined
  try {
    createdUser = await prisma.user.create({
      data: {
        username: trimmed,
        passwordHash,
        passwordEncrypted,
        role: UserRole.projeto_admin,
        projetosResponsavel: { create: { projetoId } },
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
    details: { role: UserRole.projeto_admin, projetoId, secretariaId: projeto.secretariaId },
  })

  revalidatePath('/admin')
  revalidatePath(`/admin/secretarias/${projeto.secretariaId}`)
  revalidatePath(`/admin/projetos/${projetoId}`)

  return { username: trimmed, password }
}

export async function assignProjetoUser(userId: number, projetoId: number) {
  const session = await requireSession('super_admin', 'secretaria_admin')
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

export async function resetProjetoUserPassword(userId: number, projetoId: number) {
  const session = await requireSession('super_admin', 'secretaria_admin')

  const link = await prisma.projetoResponsavel.findUnique({
    where: { userId_projetoId: { userId, projetoId } },
    select: { user: { select: { id: true, role: true } } },
  })

  if (!link || link.user.role !== UserRole.projeto_admin) {
    throw new Error('Usuário não encontrado ou não é uma conta de responsável de projeto.')
  }

  const projeto = await assertProjetoOwnership(projetoId, session)

  const password = generateRandomPassword()
  const passwordHash = await bcrypt.hash(password, 12)
  const passwordEncrypted = encryptSecret(password)

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      passwordEncrypted,
    },
  })

  await recordAuditLog({
    actorUserId: session.userId,
    action: 'user.password_reset',
    entityType: 'user',
    entityId: userId,
    targetUserId: userId,
    details: { role: UserRole.projeto_admin, projetoId, secretariaId: projeto.secretariaId },
  })

  revalidatePath('/admin')
  revalidatePath(`/admin/projetos/${projetoId}`)

  return { password }
}

export async function getProjetoUserPassword(userId: number, projetoId: number, confirmPassword: string) {
  const session = await requireSession('super_admin', 'secretaria_admin')
  await verifyOwnPassword(session.userId, session.username, confirmPassword)

  const link = await prisma.projetoResponsavel.findUnique({
    where: { userId_projetoId: { userId, projetoId } },
    select: { user: { select: { id: true, role: true, passwordEncrypted: true } } },
  })

  if (!link || link.user.role !== UserRole.projeto_admin) {
    throw new Error('Usuário não encontrado ou não é uma conta de responsável de projeto.')
  }

  await assertProjetoOwnership(projetoId, session)

  if (!link.user.passwordEncrypted) {
    throw new Error('Esta senha foi definida antes deste recurso existir. Gere uma nova senha para poder visualizá-la.')
  }

  await recordPasswordView(session.userId, link.user.id)

  return { password: decryptSecret(link.user.passwordEncrypted) }
}
