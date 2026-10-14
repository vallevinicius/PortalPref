'use server'

import { revalidatePath } from 'next/cache'
import { assertCanEdit, createSessionToken, requireSession, setSessionCookie, UnauthorizedError, type SessionPayload } from '@/lib/auth'
import { recordAuditLog } from '@/lib/audit-log'
import { prisma } from '@/lib/prisma'

async function getAuthorizedProjeto(projetoId: number, session: SessionPayload) {
  const projeto = await prisma.projeto.findUnique({
    where: { id: projetoId },
    select: { id: true, nome: true, secretariaId: true },
  })

  if (!projeto) {
    throw new UnauthorizedError('Projeto não encontrado.')
  }

  if (session.role === 'super_admin') {
    return projeto
  }

  if (session.role === 'projeto_admin') {
    if (!session.projetoIds.includes(projetoId)) {
      throw new UnauthorizedError('Você não é responsável por este projeto.')
    }
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

export async function createProjeto(
  nome: string,
  descricao: string,
  responsavelNome: string,
  responsavelTelefone: string,
  prazoAtualizacaoDias: number,
  secretariaId?: number,
) {
  const session = await requireSession('super_admin', 'secretaria_admin', 'projeto_admin')
  assertCanEdit(session)

  let targetSecretariaId: number | null | undefined
  if (session.role === 'super_admin') {
    targetSecretariaId = secretariaId
  } else if (session.role === 'secretaria_admin') {
    targetSecretariaId = session.secretariaId
    if (secretariaId !== undefined && secretariaId !== session.secretariaId) {
      throw new UnauthorizedError('Você só pode criar projetos na sua secretaria.')
    }
  } else {
    // projeto_admin: a secretaria é sempre a mesma dos projetos que ele já é responsável.
    const projetoExistente = session.projetoIds[0]
      ? await prisma.projeto.findUnique({ where: { id: session.projetoIds[0] }, select: { secretariaId: true } })
      : null
    targetSecretariaId = projetoExistente?.secretariaId ?? null
  }

  if (!targetSecretariaId) {
    throw new UnauthorizedError(
      session.role === 'super_admin'
        ? 'Informe a secretaria do projeto.'
        : 'Sua conta não está vinculada a uma secretaria.',
    )
  }

  const trimmed = nome.trim()
  if (!trimmed) {
    throw new Error('Informe o nome do projeto.')
  }

  const trimmedResponsavelNome = responsavelNome.trim()
  const trimmedResponsavelTelefone = responsavelTelefone.trim()
  if (!trimmedResponsavelNome || !trimmedResponsavelTelefone) {
    throw new Error('Informe o nome completo e o telefone de contato do responsável.')
  }

  if (!Number.isInteger(prazoAtualizacaoDias) || prazoAtualizacaoDias <= 0) {
    throw new Error('Informe de quanto em quanto tempo (em dias) o projeto precisa ser atualizado.')
  }

  const projeto = await prisma.projeto.create({
    data: {
      secretariaId: targetSecretariaId,
      nome: trimmed,
      descricao: descricao.trim() || null,
      responsavelNome: trimmedResponsavelNome,
      responsavelTelefone: trimmedResponsavelTelefone,
      prazoAtualizacaoDias,
      createdBy: session.userId,
      // O responsável de projeto que cria um projeto novo já entra como responsável
      // dele, senão ele criaria um projeto que nem consegue acessar depois.
      ...(session.role === 'projeto_admin' ? { responsaveis: { create: { userId: session.userId } } } : {}),
    },
  })

  await recordAuditLog({
    actorUserId: session.userId,
    action: 'project.create',
    entityType: 'project',
    entityId: projeto.id,
    details: { nome: projeto.nome, secretariaId: projeto.secretariaId },
  })

  revalidatePath('/admin')
  revalidatePath(`/admin/secretarias/${targetSecretariaId}`)

  // Atualiza a sessão do responsável de projeto na hora, senão ele fica sem acesso ao
  // projeto que acabou de criar até fazer login de novo (o token antigo não sabe do projeto novo).
  if (session.role === 'projeto_admin') {
    const token = await createSessionToken({
      ...session,
      projetoIds: [...session.projetoIds, projeto.id],
    })
    await setSessionCookie(token)
  }

  return { id: projeto.id }
}

export async function setPrazoAtualizacao(projetoId: number, prazoAtualizacaoDias: number) {
  const session = await requireSession('super_admin', 'secretaria_admin')
  assertCanEdit(session)
  const projeto = await getAuthorizedProjeto(projetoId, session)

  if (!Number.isInteger(prazoAtualizacaoDias) || prazoAtualizacaoDias <= 0) {
    throw new Error('Informe um número de dias válido.')
  }

  await prisma.projeto.update({
    where: { id: projetoId },
    data: { prazoAtualizacaoDias },
  })

  await recordAuditLog({
    actorUserId: session.userId,
    action: 'project.set_prazo',
    entityType: 'project',
    entityId: projetoId,
    details: { nome: projeto.nome, secretariaId: projeto.secretariaId, prazoAtualizacaoDias },
  })

  revalidatePath('/admin')
  revalidatePath(`/admin/secretarias/${projeto.secretariaId}`)
  revalidatePath(`/admin/projetos/${projetoId}`)
}

export async function updateProjeto(
  projetoId: number,
  nome: string,
  descricao: string,
  responsavelNome: string,
  responsavelTelefone: string,
) {
  const session = await requireSession('super_admin', 'secretaria_admin', 'projeto_admin')
  assertCanEdit(session)
  const projeto = await getAuthorizedProjeto(projetoId, session)

  const trimmed = nome.trim()
  if (!trimmed) {
    throw new Error('Informe o nome do projeto.')
  }

  const trimmedResponsavelNome = responsavelNome.trim()
  const trimmedResponsavelTelefone = responsavelTelefone.trim()
  if (!trimmedResponsavelNome || !trimmedResponsavelTelefone) {
    throw new Error('Informe o nome completo e o telefone de contato do responsável.')
  }

  await prisma.projeto.update({
    where: { id: projetoId },
    data: {
      nome: trimmed,
      descricao: descricao.trim() || null,
      responsavelNome: trimmedResponsavelNome,
      responsavelTelefone: trimmedResponsavelTelefone,
    },
  })

  await recordAuditLog({
    actorUserId: session.userId,
    action: 'project.update',
    entityType: 'project',
    entityId: projetoId,
    details: { nome: trimmed, secretariaId: projeto.secretariaId },
  })

  revalidatePath('/admin')
  revalidatePath(`/admin/secretarias/${projeto.secretariaId}`)
  revalidatePath(`/admin/projetos/${projetoId}`)
}

export async function deleteProjeto(projetoId: number) {
  const session = await requireSession('super_admin')
  assertCanEdit(session)
  const projeto = await getAuthorizedProjeto(projetoId, session)

  await prisma.projeto.delete({ where: { id: projetoId } })

  await recordAuditLog({
    actorUserId: session.userId,
    action: 'project.delete',
    entityType: 'project',
    entityId: projetoId,
    details: { nome: projeto.nome, secretariaId: projeto.secretariaId },
  })

  revalidatePath('/admin')
  revalidatePath(`/admin/secretarias/${projeto.secretariaId}`)
}

// Troca a secretaria responsável pelo projeto. Só o admin supremo faz isso. Devolve o erro
// como dado porque, em produção, o Next esconde a mensagem de erros lançados por server actions.
export async function moverProjetoDeSecretaria(projetoId: number, secretariaId: number): Promise<{ error?: string }> {
  const session = await requireSession('super_admin')
  if (session.canEdit === false) {
    return { error: 'Sua conta tem acesso apenas de visualização.' }
  }

  const projeto = await prisma.projeto.findUnique({
    where: { id: projetoId },
    select: { id: true, nome: true, secretariaId: true },
  })
  if (!projeto) return { error: 'Projeto não encontrado.' }
  if (projeto.secretariaId === secretariaId) return {}

  const destino = await prisma.secretaria.findUnique({ where: { id: secretariaId }, select: { id: true, nome: true } })
  if (!destino) return { error: 'Secretaria de destino não encontrada.' }

  try {
    await prisma.projeto.update({ where: { id: projetoId }, data: { secretariaId } })
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      return { error: 'Já existe um projeto com esse nome na secretaria de destino.' }
    }
    throw err
  }

  await recordAuditLog({
    actorUserId: session.userId,
    action: 'project.move',
    entityType: 'project',
    entityId: projetoId,
    details: { nome: projeto.nome, secretariaId, secretariaIdAnterior: projeto.secretariaId },
  })

  revalidatePath('/admin')
  revalidatePath(`/admin/secretarias/${projeto.secretariaId}`)
  revalidatePath(`/admin/secretarias/${secretariaId}`)
  revalidatePath(`/admin/projetos/${projetoId}`)
  return {}
}
