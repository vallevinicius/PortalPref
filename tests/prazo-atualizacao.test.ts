import { describe, expect, it } from 'vitest'
import { calcularStatusAtualizacao, diasDesde } from '@/lib/prazo-atualizacao'

const HOJE = new Date('2026-09-04T12:00:00')

describe('lib/prazo-atualizacao', () => {
  it('calcula dias corridos entre uma data e hoje', () => {
    expect(diasDesde('2026-09-04', HOJE)).toBe(0)
    expect(diasDesde('2026-08-28', HOJE)).toBe(7)
    expect(diasDesde('2026-08-14', HOJE)).toBe(21)
  })

  it('não marca como atrasado quando nenhum prazo foi configurado', () => {
    expect(calcularStatusAtualizacao('2026-01-01', null, HOJE)).toEqual({
      atrasado: false,
      diasDesdeUltimaAtualizacao: null,
    })
  })

  it('marca como atrasado quando o prazo configurado já passou', () => {
    expect(calcularStatusAtualizacao('2026-08-14', 7, HOJE)).toEqual({
      atrasado: true,
      diasDesdeUltimaAtualizacao: 21,
    })
  })

  it('não marca como atrasado quando ainda está dentro do prazo', () => {
    expect(calcularStatusAtualizacao('2026-09-01', 7, HOJE)).toEqual({
      atrasado: false,
      diasDesdeUltimaAtualizacao: 3,
    })
  })

  it('considera atrasado (sem dias calculados) quando o projeto nunca recebeu um número', () => {
    expect(calcularStatusAtualizacao(null, 30, HOJE)).toEqual({
      atrasado: true,
      diasDesdeUltimaAtualizacao: null,
    })
  })
})
