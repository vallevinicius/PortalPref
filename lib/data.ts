import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export interface Secretaria {
  id: number
  nome: string
  slug: string
  projetos_count: number
}

export interface SecretariaAdmin {
  id: number
  username: string
  secretaria_id: number
  secretaria_nome: string
}

export interface SuperAdmin {
  id: number
  username: string
}

export interface Indicador {
  id: number
  titulo: string
  valor: number
  unidade: string | null
  data_referencia: string
}

export interface IndicadorEscala {
  titulo: string
  valor_minimo: number
  valor_maximo: number
  crescente_melhor: boolean
}

export interface Projeto {
  id: number
  nome: string
  descricao: string | null
  secretaria_id: number
  secretaria_nome: string
  indicadores: Indicador[]
  escalas: IndicadorEscala[]
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function mapIndicador(indicador: {
  id: number
  titulo: string
  valor: unknown
  unidade: string | null
  dataReferencia: Date
}): Indicador {
  return {
    id: indicador.id,
    titulo: indicador.titulo,
    valor: Number(indicador.valor),
    unidade: indicador.unidade,
    data_referencia: formatDate(indicador.dataReferencia),
  }
}

function mapProjeto(projeto: {
  id: number
  nome: string
  descricao: string | null
  secretariaId: number
  secretaria: { id: number; nome: string }
  indicadores: Array<{
    id: number
    titulo: string
    valor: unknown
    unidade: string | null
    dataReferencia: Date
  }>
  indicadorEscalas: Array<{
    titulo: string
    valorMinimo: unknown
    valorMaximo: unknown
    crescenteMelhor: boolean
  }>
}): Projeto {
  return {
    id: projeto.id,
    nome: projeto.nome,
    descricao: projeto.descricao,
    secretaria_id: projeto.secretariaId,
    secretaria_nome: projeto.secretaria.nome,
    indicadores: projeto.indicadores.map(mapIndicador),
    escalas: projeto.indicadorEscalas.map((escala) => ({
      titulo: escala.titulo,
      valor_minimo: Number(escala.valorMinimo),
      valor_maximo: Number(escala.valorMaximo),
      crescente_melhor: escala.crescenteMelhor,
    })),
  }
}

const projetoRelations = {
  secretaria: { select: { id: true, nome: true } },
  indicadores: {
    orderBy: { dataReferencia: 'asc' as const },
    select: {
      id: true,
      titulo: true,
      valor: true,
      unidade: true,
      dataReferencia: true,
    },
  },
  indicadorEscalas: {
    select: {
      titulo: true,
      valorMinimo: true,
      valorMaximo: true,
      crescenteMelhor: true,
    },
  },
}

export async function getSecretariaById(id: number): Promise<Secretaria | null> {
  const secretaria = await prisma.secretaria.findUnique({
    where: { id },
    select: {
      id: true,
      nome: true,
      slug: true,
      _count: { select: { projetos: true } },
    },
  })

  if (!secretaria) return null

  return {
    id: secretaria.id,
    nome: secretaria.nome,
    slug: secretaria.slug,
    projetos_count: secretaria._count.projetos,
  }
}

export async function getSecretariaAdminBySecretariaId(secretariaId: number): Promise<SecretariaAdmin | null> {
  const user = await prisma.user.findFirst({
    where: {
      role: UserRole.secretaria_admin,
      secretariaId,
    },
    select: {
      id: true,
      username: true,
      secretariaId: true,
      secretaria: { select: { nome: true } },
    },
  })

  if (!user || user.secretariaId === null || !user.secretaria) return null

  return {
    id: user.id,
    username: user.username,
    secretaria_id: user.secretariaId,
    secretaria_nome: user.secretaria.nome,
  }
}

export async function getSecretarias(): Promise<Secretaria[]> {
  const secretarias = await prisma.secretaria.findMany({
    orderBy: { nome: 'asc' },
    select: {
      id: true,
      nome: true,
      slug: true,
      _count: { select: { projetos: true } },
    },
  })

  return secretarias.map((secretaria) => ({
    id: secretaria.id,
    nome: secretaria.nome,
    slug: secretaria.slug,
    projetos_count: secretaria._count.projetos,
  }))
}

export async function getSecretariaAdmins(): Promise<SecretariaAdmin[]> {
  const users = await prisma.user.findMany({
    where: { role: UserRole.secretaria_admin },
    orderBy: [{ secretaria: { nome: 'asc' } }, { username: 'asc' }],
    select: {
      id: true,
      username: true,
      secretariaId: true,
      secretaria: { select: { nome: true } },
    },
  })

  return users.flatMap((user) => {
    if (user.secretariaId === null || !user.secretaria) return []
    return [{
      id: user.id,
      username: user.username,
      secretaria_id: user.secretariaId,
      secretaria_nome: user.secretaria.nome,
    }]
  })
}

export async function getSuperAdmins(): Promise<SuperAdmin[]> {
  const users = await prisma.user.findMany({
    where: { role: UserRole.super_admin },
    orderBy: { username: 'asc' },
    select: { id: true, username: true },
  })

  return users
}

export async function getProjetoComIndicadores(projetoId: number): Promise<Projeto | null> {
  const projeto = await prisma.projeto.findUnique({
    where: { id: projetoId },
    include: projetoRelations,
  })

  return projeto ? mapProjeto(projeto) : null
}

export async function getProjetosComIndicadores(secretariaId: number): Promise<Projeto[]> {
  const projetos = await prisma.projeto.findMany({
    where: { secretariaId },
    orderBy: { createdAt: 'desc' },
    include: projetoRelations,
  })

  return projetos.map(mapProjeto)
}
