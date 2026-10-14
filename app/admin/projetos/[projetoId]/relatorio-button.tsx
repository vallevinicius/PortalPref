'use client'

import { Printer } from 'lucide-react'
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Indicador, Projeto } from '@/lib/data'

function isoDate(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

function formatData(iso: string) {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

function formatNumero(valor: number, unidade: string | null) {
  const numero = new Intl.NumberFormat('pt-BR').format(valor)
  return unidade ? `${numero} ${unidade}` : numero
}

const PRESETS = [
  { label: 'Mês atual', range: () => {
    const hoje = new Date()
    return [isoDate(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), isoDate(hoje)] as const
  } },
  { label: 'Últimos 30 dias', range: () => {
    const hoje = new Date()
    const inicio = new Date(hoje)
    inicio.setDate(inicio.getDate() - 29)
    return [isoDate(inicio), isoDate(hoje)] as const
  } },
  { label: 'Ano atual', range: () => {
    const hoje = new Date()
    return [isoDate(new Date(hoje.getFullYear(), 0, 1)), isoDate(hoje)] as const
  } },
]

function GraficoBarras({ pontos, unidade }: { pontos: Indicador[]; unidade: string | null }) {
  const largura = 680
  const altura = 150
  const margemTopo = 18
  const margemBase = 22
  const area = altura - margemTopo - margemBase
  const maximo = Math.max(...pontos.map((ponto) => ponto.valor), 0)
  const minimo = Math.min(...pontos.map((ponto) => ponto.valor), 0)
  const amplitude = maximo - minimo || 1
  const passo = largura / pontos.length
  const larguraBarra = Math.min(36, passo * 0.6)
  const yZero = margemTopo + (maximo / amplitude) * area
  const mostrarValores = pontos.length <= 14
  const intervaloRotulo = Math.ceil(pontos.length / 14)

  return (
    <svg viewBox={`0 0 ${largura} ${altura}`} className="rel-svg" role="img" aria-label="Gráfico de barras dos lançamentos">
      <line x1={0} x2={largura} y1={yZero} y2={yZero} stroke="#c9c8c0" strokeWidth={1} />
      {pontos.map((ponto, indice) => {
        const alturaBarra = (Math.abs(ponto.valor) / amplitude) * area
        const x = indice * passo + (passo - larguraBarra) / 2
        const y = ponto.valor >= 0 ? yZero - alturaBarra : yZero
        const [, mes, dia] = ponto.data_referencia.split('-')
        return (
          <g key={ponto.id}>
            <rect x={x} y={y} width={larguraBarra} height={Math.max(alturaBarra, 1)} rx={2} fill="#006e6d" />
            {mostrarValores && (
              <text x={x + larguraBarra / 2} y={ponto.valor >= 0 ? y - 4 : y + alturaBarra + 11} textAnchor="middle" fontSize={9} fontWeight={600} fill="#111">
                {new Intl.NumberFormat('pt-BR').format(ponto.valor)}
              </text>
            )}
            {indice % intervaloRotulo === 0 && (
              <text x={x + larguraBarra / 2} y={altura - 6} textAnchor="middle" fontSize={9} fill="#6b6a64">
                {dia}/{mes}
              </text>
            )}
          </g>
        )
      })}
      {unidade && (
        <text x={largura} y={10} textAnchor="end" fontSize={9} fill="#6b6a64">
          {unidade}
        </text>
      )}
    </svg>
  )
}

export function RelatorioButton({ projeto }: { projeto: Projeto }) {
  const [open, setOpen] = useState(false)
  const [inicio, setInicio] = useState(() => PRESETS[0].range()[0])
  const [fim, setFim] = useState(() => PRESETS[0].range()[1])
  const [imprimindo, setImprimindo] = useState(false)

  const periodoValido = inicio !== '' && fim !== '' && inicio <= fim

  const grupos = useMemo(() => {
    const porTitulo = new Map<string, Indicador[]>()
    for (const indicador of projeto.indicadores) {
      if (indicador.data_referencia < inicio || indicador.data_referencia > fim) continue
      const lista = porTitulo.get(indicador.titulo) ?? []
      lista.push(indicador)
      porTitulo.set(indicador.titulo, lista)
    }
    return Array.from(porTitulo, ([titulo, pontos]) => ({
      titulo,
      pontos: [...pontos].sort((a, b) => a.data_referencia.localeCompare(b.data_referencia)),
    })).sort((a, b) => a.titulo.localeCompare(b.titulo))
  }, [projeto.indicadores, inicio, fim])

  function handleImprimir() {
    setOpen(false)
    setImprimindo(true)
    // Espera o relatório ser montado e o diálogo fechar antes de abrir a janela de impressão.
    setTimeout(() => {
      const aoTerminar = () => {
        setImprimindo(false)
        window.removeEventListener('afterprint', aoTerminar)
      }
      window.addEventListener('afterprint', aoTerminar)
      window.print()
    }, 150)
  }

  return (
    <>
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => setOpen(true)} aria-label="Imprimir relatório em PDF" title="Imprimir relatório em PDF">
        <Printer className="size-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Relatório do projeto</DialogTitle>
            <DialogDescription>
              Escolha o período. Na janela de impressão, selecione &ldquo;Salvar como PDF&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <Button
                key={preset.label}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const [i, f] = preset.range()
                  setInicio(i)
                  setFim(f)
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="relatorio-inicio">De</Label>
              <Input id="relatorio-inicio" type="date" value={inicio} max={fim || undefined} onChange={(e) => setInicio(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="relatorio-fim">Até</Label>
              <Input id="relatorio-fim" type="date" value={fim} min={inicio || undefined} onChange={(e) => setFim(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {periodoValido
              ? `${grupos.length} gráfico${grupos.length === 1 ? '' : 's'} com dados no período.`
              : 'Informe um período válido (a data inicial não pode ser depois da final).'}
          </p>
          <Button type="button" onClick={handleImprimir} disabled={!periodoValido} className="gap-1.5">
            <Printer className="size-4" />
            Gerar PDF
          </Button>
        </DialogContent>
      </Dialog>

      {imprimindo &&
        createPortal(
          <div id="relatorio-impressao">
            <table className="rel-pagina">
              <thead>
                <tr>
                  <td>
                    <div className="rel-margem" />
                  </td>
                </tr>
              </thead>
              <tfoot>
                <tr>
                  <td>
                    <div className="rel-margem" />
                  </td>
                </tr>
              </tfoot>
              <tbody>
                <tr>
                  <td className="rel-conteudo">
                    <header className="rel-topo">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/Pref.png" alt="Prefeitura Municipal de Saquarema" className="rel-logo" />
                      <div className="rel-topo-info">
                        <strong>Relatório de projeto</strong>
                        <span>Emitido em {formatData(isoDate(new Date()))}</span>
                      </div>
                    </header>

                    <section className="rel-projeto">
                      <p className="rel-secretaria">{projeto.secretaria_nome}</p>
                      <h1>{projeto.nome}</h1>
                      {projeto.descricao && <p className="rel-descricao">{projeto.descricao}</p>}
                      <dl className="rel-fatos">
                        <div>
                          <dt>Período</dt>
                          <dd>
                            {formatData(inicio)} a {formatData(fim)}
                          </dd>
                        </div>
                        {projeto.responsavel_nome && (
                          <div>
                            <dt>Responsável</dt>
                            <dd>{projeto.responsavel_nome}</dd>
                          </div>
                        )}
                        {projeto.responsavel_telefone && (
                          <div>
                            <dt>Contato</dt>
                            <dd>{projeto.responsavel_telefone}</dd>
                          </div>
                        )}
                        <div>
                          <dt>Gráficos</dt>
                          <dd>{grupos.length}</dd>
                        </div>
                      </dl>
                    </section>

                    {grupos.length === 0 && <p className="rel-vazio">Nenhum número lançado neste período.</p>}

                    {grupos.map((grupo) => {
                      const unidade = grupo.pontos[0]?.unidade ?? null
                      const soma = grupo.pontos.reduce((total, ponto) => total + ponto.valor, 0)
                      const media = soma / grupo.pontos.length
                      const diferenca = grupo.pontos[grupo.pontos.length - 1].valor - grupo.pontos[0].valor
                      return (
                        <section key={grupo.titulo} className="rel-grafico">
                          <h2>{grupo.titulo}</h2>
                          <div className="rel-kpis">
                            <div>
                              <span>Lançamentos</span>
                              <strong>{grupo.pontos.length}</strong>
                            </div>
                            <div>
                              <span>Soma</span>
                              <strong>{formatNumero(soma, unidade)}</strong>
                            </div>
                            <div>
                              <span>Média</span>
                              <strong>{formatNumero(Math.round(media * 100) / 100, unidade)}</strong>
                            </div>
                            <div>
                              <span>Diferença (último − primeiro)</span>
                              <strong>{formatNumero(diferenca, unidade)}</strong>
                            </div>
                          </div>
                          <GraficoBarras pontos={grupo.pontos} unidade={unidade} />
                          <table className="rel-dados">
                            <thead>
                              <tr>
                                <th>Data</th>
                                <th>Valor</th>
                              </tr>
                            </thead>
                            <tbody>
                              {grupo.pontos.map((ponto) => (
                                <tr key={ponto.id}>
                                  <td>{formatData(ponto.data_referencia)}</td>
                                  <td>{formatNumero(ponto.valor, unidade)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </section>
                      )
                    })}
                  </td>
                </tr>
              </tbody>
            </table>
            <footer className="rel-rodape">Portal de Dados Integrados · Prefeitura Municipal de Saquarema</footer>
          </div>,
          document.body,
        )}
    </>
  )
}
