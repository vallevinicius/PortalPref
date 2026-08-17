'use server'

import { revalidatePath } from 'next/cache'
import { requireSession, UnauthorizedError } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function getOwnedProjeto(projetoId: number, secretariaId: number) {
  const projeto = await prisma.projeto.findUnique({
    where: { id: projetoId },
    select: { id: true, secretariaId: true },
  })

  if (!projeto || projeto.secretariaId !== secretariaId) {
    throw new UnauthorizedError('Este projeto não pertence à sua secretaria.')
  }

  return projeto
}

export async function createProjeto(nome: string, descricao: string) {
  const session = await requireSession('secretaria_admin')
  if (!session.secretariaId) {
    throw new UnauthorizedError('Sua conta não está vinculada a uma secretaria.')
  }

  const trimmed = nome.trim()
  if (!trimmed) {
    throw new Error('Informe o nome do projeto.')
  }

  await prisma.projeto.create({
    data: {
      secretariaId: session.secretariaId,
      nome: trimmed,
      descricao: descricao.trim() || null,
      createdBy: session.userId,
    },
  })

  revalidatePath('/admin')
}

export async function updateProjeto(projetoId: number, nome: string, descricao: string) {
  const session = await requireSession('secretaria_admin')
  if (!session.secretariaId) {
    throw new UnauthorizedError('Sua conta não está vinculada a uma secretaria.')
  }
  await getOwnedProjeto(projetoId, session.secretariaId)

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
}

export async function deleteProjeto(projetoId: number) {
  const session = await requireSession('secretaria_admin')
  if (!session.secretariaId) {
    throw new UnauthorizedError('Sua conta não está vinculada a uma secretaria.')
  }
  await getOwnedProjeto(projetoId, session.secretariaId)

  await prisma.projeto.delete({ where: { id: projetoId } })

  revalidatePath('/admin')
}
