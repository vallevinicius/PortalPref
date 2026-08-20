import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = process.cwd()

function readProjectFile(relativePath: string) {
  return readFileSync(resolve(projectRoot, relativePath), 'utf8')
}

describe('proteção de visibilidade do site', () => {
  it('mantém o metadata global fora dos mecanismos de busca', () => {
    const layout = readProjectFile('app/layout.tsx')

    expect(layout).toContain('index: false')
    expect(layout).toContain('follow: false')
    expect(layout).toContain('noarchive: true')
    expect(layout).toContain('nosnippet: true')
  })

  it('bloqueia o rastreamento de todas as rotas', () => {
    const robots = readProjectFile('app/robots.ts')

    expect(robots).toContain("userAgent: '*'")
    expect(robots).toContain("disallow: '/'")
  })

  it('envia cabeçalho para evitar indexação mesmo fora do HTML', () => {
    const nextConfig = readProjectFile('next.config.mjs')

    expect(nextConfig).toContain('key: "X-Robots-Tag"')
    expect(nextConfig).toContain('noindex, nofollow, noarchive')
  })
})
