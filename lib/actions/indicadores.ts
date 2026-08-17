'use server'

import { revalidatePath } from 'next/cache'
import { requireSession, UnauthorizedError } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function parseDataReferencia(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Preencha título, valor e data do indicador.')
  }

  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error('Preencha título, valor e data do indicador.')
  }

  return date
}

async function assertOwnsProjeto(projetoId: number, secretariaId: number) {
  const projeto = await prisma.projeto.findUnique({
    where: { id: projetoId },
    select: { id: true, secretariaId: true },
  })

  if (!projeto || projeto.secretariaId !== secretariaId) {
    throw new UnauthorizedError('Este projeto não pertence à sua secretaria.')
  }
}

async function assertOwnsIndicador(indicadorId: number, secretariaId: number) {
  const indicador = await prisma.indicador.findUnique({
    where: { id: indicadorId },
    select: { id: true, projeto: { select: { secretariaId: true } } },
  })

  if (!indicador || indicador.projeto.secretariaId !== secretariaId) {
    throw new UnauthorizedError('Este indicador não pertence à sua secretaria.')
  }
}

function validateIndicador(titulo: string, valor: number, dataReferencia: string) {
  const trimmedTitulo = titulo.trim()
  if (!trimmedTitulo || !Number.isFinite(valor) || !dataReferencia) {
    throw new Error('Preencha título, valor e data do indicador.')
  }

  return {
    titulo: trimmedTitulo,
    dataReferencia: parseDataReferencia(dataReferencia),
  }
}

export async function createIndicador(
  projetoId: number,
  titulo: string,
  valor: number,
  unidade: string,
  dataReferencia: string,
) {
  const session = await requireSession('secretaria_admin')
  if (!session.secretariaId) {
    throw new UnauthorizedError('Sua conta não está vinculada a uma secretaria.')
  }
  await assertOwnsProjeto(projetoId, session.secretariaId)

  const validated = validateIndicador(titulo, valor, dataReferencia)

  await prisma.indicador.create({
    data: {
      projetoId,
      titulo: validated.titulo,
      valor,
      unidade: unidade.trim() || null,
      dataReferencia: validated.dataReferencia,
      createdBy: session.userId,
    },
  })

  revalidatePath('/admin')
}

export async function updateIndicador(
  indicadorId: number,
  titulo: string,
  valor: number,
  unidade: string,
  dataReferencia: string,
) {
  const session = await requireSession('secretaria_admin')
  if (!session.secretariaId) {
    throw new UnauthorizedError('Sua conta não está vinculada a uma secretaria.')
  }
  await assertOwnsIndicador(indicadorId, session.secretariaId)

  const validated = validateIndicador(titulo, valor, dataReferencia)

  await prisma.indicador.update({
    where: { id: indicadorId },
    data: {
      titulo: validated.titulo,
      valor,
      unidade: unidade.trim() || null,
      dataReferencia: validated.dataReferencia,
    },
  })

  revalidatePath('/admin')
}

export async function deleteIndicador(indicadorId: number) {
  const session = await requireSession('secretaria_admin')
  if (!session.secretariaId) {
    throw new UnauthorizedError('Sua conta não está vinculada a uma secretaria.')
  }
  await assertOwnsIndicador(indicadorId, session.secretariaId)

  await prisma.indicador.delete({ where: { id: indicadorId } })

  revalidatePath('/admin')
}
