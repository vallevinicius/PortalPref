'use server'

import { revalidatePath } from 'next/cache'
import { requireSession, UnauthorizedError, type SessionPayload } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function getAuthorizedProjeto(projetoId: number, session: SessionPayload) {
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

  if (!session.secretariaId) {
    throw new UnauthorizedError('Sua conta não está vinculada a uma secretaria.')
  }

  if (projeto.secretariaId !== session.secretariaId) {
    throw new UnauthorizedError('Este projeto não pertence à sua secretaria.')
  }

  return projeto
}

export async function createProjeto(nome: string, descricao: string, secretariaId?: number) {
  const session = await requireSession('super_admin', 'secretaria_admin')
  const targetSecretariaId = session.role === 'super_admin' ? secretariaId : session.secretariaId

  if (!targetSecretariaId) {
    throw new UnauthorizedError(
      session.role === 'super_admin'
        ? 'Informe a secretaria do projeto.'
        : 'Sua conta não está vinculada a uma secretaria.',
    )
  }

  if (session.role === 'secretaria_admin' && secretariaId !== undefined && secretariaId !== session.secretariaId) {
    throw new UnauthorizedError('Você só pode criar projetos na sua secretaria.')
  }

  const trimmed = nome.trim()
  if (!trimmed) {
    throw new Error('Informe o nome do projeto.')
  }

  await prisma.projeto.create({
    data: {
      secretariaId: targetSecretariaId,
      nome: trimmed,
      descricao: descricao.trim() || null,
      createdBy: session.userId,
    },
  })

  revalidatePath('/admin')
  revalidatePath(`/admin/secretarias/${targetSecretariaId}`)
}

export async function updateProjeto(projetoId: number, nome: string, descricao: string) {
  const session = await requireSession('super_admin', 'secretaria_admin')
  const projeto = await getAuthorizedProjeto(projetoId, session)

  const trimmed = nome.trim()
  if (!trimmed) {
    throw new Error('Informe o nome do projeto.')
  }

  await prisma.projeto.update({
    where: { id: projetoId },
    data: {
      nome: trimmed,
      descricao: descricao.trim() || null,
    },
  })

  revalidatePath('/admin')
  revalidatePath(`/admin/secretarias/${projeto.secretariaId}`)
  revalidatePath(`/admin/projetos/${projetoId}`)
}

export async function deleteProjeto(projetoId: number) {
  const session = await requireSession('super_admin', 'secretaria_admin')
  const projeto = await getAuthorizedProjeto(projetoId, session)

  await prisma.projeto.delete({ where: { id: projetoId } })

  revalidatePath('/admin')
  revalidatePath(`/admin/secretarias/${projeto.secretariaId}`)
}
