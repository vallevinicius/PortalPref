'use server'

import bcrypt from 'bcryptjs'
import { UserRole } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { recordAuditLog } from '@/lib/audit-log'
import { requireSession } from '@/lib/auth'
import { decryptSecret, encryptSecret } from '@/lib/crypto'
import { generateRandomPassword } from '@/lib/password'
import { prisma } from '@/lib/prisma'

async function verifyOwnPassword(userId: number, confirmPassword: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  })

  if (!user || !(await bcrypt.compare(confirmPassword, user.passwordHash))) {
    throw new Error('Senha incorreta.')
  }
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
  await verifyOwnPassword(session.userId, confirmPassword)

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
    select: { id: true, role: true },
  })

  if (!target || target.role !== UserRole.super_admin) {
    throw new Error('Usuário não encontrado ou não é uma conta de administrador supremo.')
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
  await verifyOwnPassword(session.userId, confirmPassword)

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, passwordEncrypted: true },
  })

  if (!target || target.role !== UserRole.super_admin) {
    throw new Error('Usuário não encontrado ou não é uma conta de administrador supremo.')
  }

  if (!target.passwordEncrypted) {
    throw new Error('Esta senha foi definida antes deste recurso existir. Gere uma nova senha para poder visualizá-la.')
  }

  await recordPasswordView(session.userId, target.id)

  return { password: decryptSecret(target.passwordEncrypted) }
}
