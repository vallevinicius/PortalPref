export type TipoValor = 'numero' | 'dinheiro'

export const TIPOS_VALOR: readonly TipoValor[] = ['numero', 'dinheiro']

export function isTipoValor(value: unknown): value is TipoValor {
  return value === 'numero' || value === 'dinheiro'
}

// Formata o valor de um indicador conforme o tipo escolhido na criação do gráfico:
// "dinheiro" vira moeda brasileira (R$ 1.234,56); "numero" segue o formato pt-BR, com a unidade (se houver).
export function formatValorIndicador(valor: number, tipoValor: TipoValor = 'numero', unidade: string | null = null) {
  if (tipoValor === 'dinheiro') {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
  }

  const numero = new Intl.NumberFormat('pt-BR').format(valor)
  return unidade ? `${numero} ${unidade}` : numero
}
