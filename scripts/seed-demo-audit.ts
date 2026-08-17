import path from 'node:path'
import process from 'node:process'

process.loadEnvFile(path.resolve(process.cwd(), '.env'))

import bcrypt from 'bcryptjs'
import { UserRole } from '@prisma/client'
import { recordAuditLog } from '../lib/audit-log'
import { prisma } from '../lib/prisma'
import { slugify } from '../lib/slug'

const SEED_KEY = 'audit-log-demo-v1'
const DEMO_PASSWORD = 'Demo@1234'

const DEMO_SECRETARIAS = [
  'Secretaria de Saúde',
  'Secretaria de Educação',
  'Secretaria de Obras e Urbanismo',
  'Secretaria de Desenvolvimento Social',
  'Secretaria de Meio Ambiente',
  'Secretaria de Cultura e Turismo',
]

const PROJECT_TEMPLATES = [
  { nome: 'Atendimento integrado ao cidadão', descricao: 'Acompanhamento dos serviços prioritários para a população.' },
  { nome: 'Modernização dos processos internos', descricao: 'Digitalização, transparência e melhoria contínua da gestão.' },
  { nome: 'Indicadores estratégicos 2026', descricao: 'Painel demonstrativo com metas e resultados do exercício.' },
]

const INDICATOR_TEMPLATES = [
  { titulo: 'Pessoas atendidas', valor: 1250, unidade: 'pessoas' },
  { titulo: 'Taxa de execução', valor: 78.5, unidade: '%' },
]

async function ensureProject(secretariaId: number, project: (typeof PROJECT_TEMPLATES)[number], createdBy: number) {
  const existing = await prisma.projeto.findFirst({ where: { secretariaId, nome: project.nome }, select: { id: true, nome: true } })
  if (existing) return existing

  return prisma.projeto.create({
    data: { secretariaId, nome: project.nome, descricao: project.descricao, createdBy },
    select: { id: true, nome: true },
  })
}

async function ensureIndicator(projetoId: number, indicator: (typeof INDICATOR_TEMPLATES)[number], createdBy: number) {
  const existing = await prisma.indicador.findFirst({ where: { projetoId, titulo: indicator.titulo }, select: { id: true, titulo: true } })
  if (existing) return existing

  return prisma.indicador.create({
    data: {
      projetoId,
      titulo: indicator.titulo,
      valor: indicator.valor,
      unidade: indicator.unidade,
      dataReferencia: new Date('2026-08-01T00:00:00.000Z'),
      createdBy,
    },
    select: { id: true, titulo: true },
  })
}

async function main() {
  const adminUsername = process.env.ADMIN_USERNAME
  if (!adminUsername) throw new Error('Defina ADMIN_USERNAME no .env antes de rodar o seed demonstrativo.')

  const admin = await prisma.user.findUnique({ where: { username: adminUsername }, select: { id: true, username: true, role: true } })
  if (!admin || admin.role !== UserRole.super_admin) {
    throw new Error('Execute npm run db:seed antes do seed demonstrativo para criar o admin supremo.')
  }

  const previousSeed = await prisma.user.findUnique({ where: { username: 'demo-1' }, select: { id: true } })
  if (previousSeed) {
    console.log('O seed demonstrativo já foi executado. Nenhuma alteração foi feita.')
    return
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10)
  let secretariasCount = 0
  let usersCount = 0
  let projetosCount = 0
  let indicadoresCount = 0

  for (const [secretariaIndex, nome] of DEMO_SECRETARIAS.entries()) {
    const slug = slugify(nome)
    const secretaria = await prisma.secretaria.upsert({
      where: { slug },
      create: { nome, slug },
      update: { nome },
      select: { id: true, nome: true },
    })
    secretariasCount += 1

    const demoUsername = `demo-${secretariaIndex + 1}`
    const demoUser = await prisma.user.upsert({
      where: { username: demoUsername },
      create: {
        username: demoUsername,
        passwordHash,
        role: UserRole.secretaria_admin,
        secretariaId: secretaria.id,
      },
      update: { passwordHash, role: UserRole.secretaria_admin, secretariaId: secretaria.id },
      select: { id: true, username: true },
    })
    usersCount += 1

    await recordAuditLog({
      actorUserId: admin.id,
      action: 'secretaria.create',
      entityType: 'secretaria',
      entityId: secretaria.id,
      details: { nome: secretaria.nome, seedKey: SEED_KEY },
    })
    await recordAuditLog({
      actorUserId: admin.id,
      action: 'user.create',
      entityType: 'user',
      entityId: demoUser.id,
      targetUserId: demoUser.id,
      details: { username: demoUser.username, role: UserRole.secretaria_admin, secretariaId: secretaria.id, seedKey: SEED_KEY },
    })

    for (const [projectIndex, projectTemplate] of PROJECT_TEMPLATES.entries()) {
      const project = await ensureProject(secretaria.id, projectTemplate, admin.id)
      projetosCount += 1

      await recordAuditLog({
        actorUserId: demoUser.id,
        action: 'project.create',
        entityType: 'project',
        entityId: project.id,
        details: { nome: project.nome, secretariaId: secretaria.id, seedKey: SEED_KEY },
      })

      for (const [indicatorIndex, indicatorTemplate] of INDICATOR_TEMPLATES.entries()) {
        const indicator = await ensureIndicator(project.id, {
          ...indicatorTemplate,
          valor: indicatorTemplate.valor + secretariaIndex * 100 + projectIndex * 25 + indicatorIndex * 5,
        }, admin.id)
        indicadoresCount += 1

        await recordAuditLog({
          actorUserId: demoUser.id,
          action: 'indicator.create',
          entityType: 'indicator',
          entityId: indicator.id,
          details: { titulo: indicator.titulo, projetoId: project.id, secretariaId: secretaria.id, seedKey: SEED_KEY },
        })
      }
    }

  }

  console.log(`Seed demonstrativo concluído: ${secretariasCount} secretarias, ${usersCount} usuários, ${projetosCount} projetos, ${indicadoresCount} indicadores e eventos de auditoria criados.`)
  console.log(`Usuários demo: demo-1 até demo-${DEMO_SECRETARIAS.length} | senha: ${DEMO_PASSWORD}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
