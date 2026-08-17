import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

type PackageManifest = {
  scripts?: Record<string, string>
}

const projectRoot = path.resolve(process.cwd())
const packageManifest = JSON.parse(
  fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'),
) as PackageManifest
const seedAdminSource = fs.readFileSync(path.join(projectRoot, 'scripts', 'seed-admin.ts'), 'utf8')

describe('contrato do seed padrão', () => {
  it('aponta exclusivamente para o seed do super administrador', () => {
    expect(packageManifest.scripts?.['db:seed']).toBe('tsx scripts/seed-admin.ts')
    expect(packageManifest.scripts?.['db:seed']).not.toContain('seed-demo')
    expect(seedAdminSource).not.toContain('seed-demo')
  })

  it('não conecta o seed demonstrativo aos comandos de setup', () => {
    expect(packageManifest.scripts?.['db:setup']).not.toContain('db:seed-demo')
    expect(packageManifest.scripts?.['db:setup:deploy']).not.toContain('db:seed-demo')
  })
})
