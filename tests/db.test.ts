import { afterEach, describe, expect, it } from 'vitest'
import { getDatabaseConfig } from '@/lib/db'

describe('configuração do banco', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('lê e decodifica a DATABASE_URL do MySQL', () => {
    process.env.DATABASE_URL = 'mysql://root:senha%40segura@localhost:3307/portal%20dados'
    delete process.env.DB_HOST
    delete process.env.DB_USER
    delete process.env.DB_PASSWORD
    delete process.env.DB_NAME

    expect(getDatabaseConfig()).toEqual({
      host: 'localhost',
      port: 3307,
      user: 'root',
      password: 'senha@segura',
      database: 'portal dados',
    })
  })

  it('mantém compatibilidade com as variáveis DB_*', () => {
    delete process.env.DATABASE_URL
    process.env.DB_HOST = '127.0.0.1'
    process.env.DB_PORT = '3306'
    process.env.DB_USER = 'root'
    process.env.DB_PASSWORD = 'vinicius'
    process.env.DB_NAME = 'portaldados'

    expect(getDatabaseConfig()).toEqual({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: 'vinicius',
      database: 'portaldados',
    })
  })

  it('rejeita DATABASE_URL malformada', () => {
    process.env.DATABASE_URL = 'postgres://root:senha@localhost:5432/portaldados'

    expect(() => getDatabaseConfig()).toThrow('DATABASE_URL deve usar o protocolo mysql://.')
  })

  it('rejeita ambiente sem configuração de banco', () => {
    delete process.env.DATABASE_URL
    delete process.env.DB_HOST
    delete process.env.DB_USER
    delete process.env.DB_PASSWORD
    delete process.env.DB_NAME

    expect(() => getDatabaseConfig()).toThrow('Banco não configurado.')
  })
})
