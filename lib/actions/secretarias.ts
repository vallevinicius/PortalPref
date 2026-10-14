'use server'

import { revalidatePath } from 'next/cache'
import { recordAuditLog } from '@/lib/audit-log'
import { assertCanEdit, requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

import { slugify } from '@/lib/slug'

// Em produção o Next mascara a mensagem de erros lançados por server actions
// (o cliente só vê "Minified React error #441"), então falhas esperadas voltam como dado.
export async function createSecretaria(nome: string): Promise<{ error?: string }> {
  const session = await requireSession('super_admin')
  if (session.canEdit === false) {
    return { error: 'Sua conta tem acesso apenas de visualização.' }
  }
  assertCanEdit(session)

  const trimmed = nome.trim()
  if (!trimmed) {
    return { error: 'Informe o nome da secretaria.' }
  }
  const slug = slugify(trimmed)
  if (!slug) {
    return { error: 'O nome da secretaria deve conter letras ou números.' }
  }

  try {
    const secretaria = await prisma.secretaria.create({
      data: {
        nome: trimmed,
        slug,
      },
    })

    await recordAuditLog({
      actorUserId: session.userId,
      action: 'secretaria.create',
      entityType: 'secretaria',
      entityId: secretaria.id,
      details: { nome: secretaria.nome },
    })
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      return { error: 'Já existe uma secretaria com esse nome.' }
    }
    throw err
  }

  revalidatePath('/admin')
  return {}
}

export async function updateSecretaria(secretariaId: number, nome: string): Promise<{ error?: string }> {
  const session = await requireSession('super_admin')
  if (session.canEdit === false) {
    return { error: 'Sua conta tem acesso apenas de visualização.' }
  }
  assertCanEdit(session)

  const trimmed = nome.trim()
  if (!trimmed) {
    return { error: 'Informe o nome da secretaria.' }
  }
  const slug = slugify(trimmed)
  if (!slug) {
    return { error: 'O nome da secretaria deve conter letras ou números.' }
  }

  const atual = await prisma.secretaria.findUnique({ where: { id: secretariaId }, select: { nome: true } })
  if (!atual) {
    return { error: 'Secretaria não encontrada.' }
  }

  try {
    await prisma.secretaria.update({ where: { id: secretariaId }, data: { nome: trimmed, slug } })
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      return { error: 'Já existe uma secretaria com esse nome.' }
    }
    throw err
  }

  await recordAuditLog({
    actorUserId: session.userId,
    action: 'secretaria.update',
    entityType: 'secretaria',
    entityId: secretariaId,
    details: { nome: trimmed, nomeAnterior: atual.nome },
  })

  revalidatePath('/admin')
  revalidatePath(`/admin/secretarias/${secretariaId}`)
  return {}
}

// Exclui a secretaria, seus projetos/indicadores (cascade no banco) e os usuários que só
// existem por causa dela (secretário e responsáveis cujos projetos são todos desta secretaria).
export async function deleteSecretaria(secretariaId: number): Promise<{ error?: string }> {
  const session = await requireSession('super_admin')
  if (session.canEdit === false) {
    return { error: 'Sua conta tem acesso apenas de visualização.' }
  }
  assertCanEdit(session)

  const secretaria = await prisma.secretaria.findUnique({
    where: { id: secretariaId },
    select: { id: true, nome: true, _count: { select: { projetos: true } } },
  })
  if (!secretaria) {
    return { error: 'Secretaria não encontrada.' }
  }

  const usuarios = await prisma.user.findMany({
    where: {
      role: { in: ['secretaria_admin', 'projeto_admin'] },
      OR: [
        { secretariaId },
        { projetosResponsavel: { some: { projeto: { secretariaId } } } },
      ],
    },
    select: { id: true, role: true, projetosResponsavel: { select: { projeto: { select: { secretariaId: true } } } } },
  })
  const usuarioIds = usuarios
    .filter(
      (u) =>
        u.role === 'secretaria_admin' || u.projetosResponsavel.every((link) => link.projeto.secretariaId === secretariaId),
    )
    .map((u) => u.id)
    .filter((id) => id !== session.userId)

  await prisma.$transaction([
    prisma.user.deleteMany({ where: { id: { in: usuarioIds } } }),
    prisma.secretaria.delete({ where: { id: secretariaId } }),
  ])

  await recordAuditLog({
    actorUserId: session.userId,
    action: 'secretaria.delete',
    entityType: 'secretaria',
    details: { nome: secretaria.nome, projetosExcluidos: secretaria._count.projetos, usuariosExcluidos: usuarioIds.length },
  })

  revalidatePath('/admin')
  return {}
}
